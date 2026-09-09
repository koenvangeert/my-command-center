//! Keep Hyper's parser as the single HTTP parser while giving its pre-dispatch
//! failures the gateway's not-executed envelope instead of an empty HTTP error.
use axum::{body::to_bytes, http::StatusCode, Router};
use hyper::service::Service;
use hyper_util::{
    rt::{TokioIo, TokioTimer},
    service::TowerToHyperService,
};
use std::{
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    task::{Context, Poll},
    time::Duration,
};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadBuf},
    net::TcpStream,
};

pub(crate) async fn serve(mut stream: TcpStream, router: Router, deadline: Duration) {
    let dispatched = Arc::new(AtomicBool::new(false));
    let service_dispatched = Arc::clone(&dispatched);
    let service = hyper::service::service_fn(move |request| {
        // One request per connection: after dispatch, preserve every handler/Sidecar
        // response as-is. In particular a forwarded 400 is not a parser rejection.
        service_dispatched.store(true, Ordering::Release);
        let service = TowerToHyperService::new(router.clone());
        async move { service.call(request).await }
    });
    let io = ParserResponseGate {
        stream: &mut stream,
        dispatched: &dispatched,
    };
    let mut builder = hyper::server::conn::http1::Builder::new();
    builder
        .keep_alive(false)
        .max_buf_size(16 * 1024)
        .timer(TokioTimer::new())
        .header_read_timeout(Duration::from_secs(2));
    let result = tokio::time::timeout(
        deadline,
        builder.serve_connection(TokioIo::new(io), service),
    )
    .await;
    if dispatched.load(Ordering::Acquire) {
        return;
    }
    let status = match result {
        Ok(Ok(())) => return,
        Ok(Err(error)) if error.is_parse_too_large() => StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE,
        Err(_) => StatusCode::REQUEST_TIMEOUT,
        Ok(Err(error)) if error.is_timeout() => StatusCode::REQUEST_TIMEOUT,
        Ok(Err(_)) => StatusCode::BAD_REQUEST,
    };
    let response = crate::agent_gateway::rejected(
        status,
        "invalid or incomplete HTTP request; request not executed",
    );
    let Ok(body) = to_bytes(response.into_body(), 4096).await else {
        return;
    };
    let header = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", status.as_u16(), status.canonical_reason().unwrap_or("Bad Request"), body.len());
    let _ = tokio::time::timeout(Duration::from_millis(200), async {
        stream.write_all(header.as_bytes()).await?;
        stream.write_all(&body).await?;
        stream.shutdown().await
    })
    .await;
    // Drain a bounded amount of unread input after FIN to avoid discarding the
    // rejection with a TCP reset. This never dispatches or queues domain work.
    let _ = tokio::time::timeout(
        Duration::from_millis(200),
        tokio::io::copy(&mut stream.take(64 * 1024), &mut tokio::io::sink()),
    )
    .await;
}

/// Hyper normally emits its own empty 400/431 before returning a parse error.
/// Consume only these pre-dispatch writes and keep the borrowed socket open so
/// `serve` can send the explicit failure. Valid responses use the socket directly.
struct ParserResponseGate<'a> {
    stream: &'a mut TcpStream,
    dispatched: &'a AtomicBool,
}
impl AsyncRead for ParserResponseGate<'_> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut *self.stream).poll_read(cx, buf)
    }
}
impl AsyncWrite for ParserResponseGate<'_> {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        if self.dispatched.load(Ordering::Acquire) {
            Pin::new(&mut *self.stream).poll_write(cx, buf)
        } else {
            Poll::Ready(Ok(buf.len()))
        }
    }
    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        if self.dispatched.load(Ordering::Acquire) {
            Pin::new(&mut *self.stream).poll_flush(cx)
        } else {
            Poll::Ready(Ok(()))
        }
    }
    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        if self.dispatched.load(Ordering::Acquire) {
            Pin::new(&mut *self.stream).poll_shutdown(cx)
        } else {
            Poll::Ready(Ok(()))
        }
    }
}
