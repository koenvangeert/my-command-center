//! Isolated macOS adapter. Raw descriptors deliberately have no Drop owner until
//! readiness: a controlled initialization failure must be able to reexec fallback.
use super::Result;
use serde::{Deserialize, Serialize};
use std::ffi::CString;
use std::io;

#[derive(Serialize, Deserialize)]
pub(super) struct Pty {
    pub pid: libc::pid_t,
    pub fd: libc::c_int,
    pub reaped: bool,
    pub status: libc::c_int,
}

impl Pty {
    pub fn spawn(fixture: &str) -> Result<Self> {
        let executable = CString::new(fixture)?;
        let mut master = -1;
        let mut slave = -1;
        let mut size = libc::winsize {
            ws_row: 4,
            ws_col: 20,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        // SAFETY: output descriptors and size reference valid local storage.
        if unsafe {
            libc::openpty(
                &mut master,
                &mut slave,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            )
        } != 0
        {
            return Err(io::Error::last_os_error().into());
        }
        // SAFETY: this experiment is single-threaded; child only invokes libc before exec.
        let pid = unsafe { libc::fork() };
        if pid == 0 {
            // SAFETY: descriptors come from openpty; all child paths exec or _exit.
            unsafe {
                if libc::setsid() < 0 || libc::ioctl(slave, libc::TIOCSCTTY as libc::c_ulong, 0) < 0
                {
                    libc::_exit(126);
                }
                for fd in 0..3 {
                    if libc::dup2(slave, fd) < 0 {
                        libc::_exit(126);
                    }
                }
                for fd in 3..libc::getdtablesize() {
                    libc::close(fd);
                }
                libc::execl(
                    executable.as_ptr(),
                    executable.as_ptr(),
                    std::ptr::null::<libc::c_char>(),
                );
                libc::_exit(127);
            }
        }
        // SAFETY: slave belongs exclusively to this parent after fork.
        unsafe {
            libc::close(slave);
        }
        if pid < 0 {
            let error = io::Error::last_os_error();
            // SAFETY: no child exists; master is exclusively ours.
            unsafe {
                libc::close(master);
            }
            return Err(error.into());
        }
        Ok(Self {
            pid,
            fd: master,
            reaped: false,
            status: 0,
        })
    }

    pub fn read(&self) -> Result<Vec<u8>> {
        let mut poll = libc::pollfd {
            fd: self.fd,
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: one initialized pollfd is supplied for this owned master.
        let ready = unsafe { libc::poll(&mut poll, 1, 100) };
        if ready < 0 {
            return Err(io::Error::last_os_error().into());
        }
        if ready == 0 {
            return Ok(Vec::new());
        }
        let mut bytes = vec![0; 4096];
        // SAFETY: buffer length is its initialized capacity; descriptor is retained.
        let length = unsafe { libc::read(self.fd, bytes.as_mut_ptr().cast(), bytes.len()) };
        if length < 0 {
            let error = io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::EIO) {
                return Ok(Vec::new());
            }
            return Err(error.into());
        }
        bytes.truncate(length as usize);
        Ok(bytes)
    }

    pub fn geometry(&self) -> Result<libc::winsize> {
        let mut size = libc::winsize {
            ws_row: 0,
            ws_col: 0,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        // SAFETY: valid mutable winsize storage and an inherited PTY master.
        if unsafe { libc::ioctl(self.fd, libc::TIOCGWINSZ, &mut size) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        Ok(size)
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let size = libc::winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        // SAFETY: valid winsize storage and the owned master descriptor.
        if unsafe { libc::ioctl(self.fd, libc::TIOCSWINSZ, &size) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        Ok(())
    }

    pub fn reap(&mut self) -> Result<()> {
        if self.reaped {
            return Ok(());
        }
        // SAFETY: waitpid validates kernel parenthood; no saved PID is signaled here.
        let result = unsafe { libc::waitpid(self.pid, &mut self.status, libc::WNOHANG) };
        if result < 0 {
            return Err(io::Error::last_os_error().into());
        }
        self.reaped = result == self.pid;
        Ok(())
    }

    pub fn stop(&mut self) -> Result<()> {
        self.reap()?;
        if !self.reaped {
            // SAFETY: successful non-reaping waitpid pins our direct child's PID.
            unsafe {
                libc::kill(self.pid, libc::SIGTERM);
            }
        }
        // SAFETY: normal teardown closes our sole master, never during handoff.
        unsafe {
            libc::close(self.fd);
        }
        if !self.reaped {
            // SAFETY: same unreaped direct child; fixture has default signal handling.
            while unsafe { libc::waitpid(self.pid, &mut self.status, 0) } < 0 {
                if io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
                    break;
                }
            }
        }
        self.reaped = true;
        Ok(())
    }
}

pub(super) fn write(fd: libc::c_int, mut bytes: &[u8]) -> Result<()> {
    while !bytes.is_empty() {
        // SAFETY: slice is valid; descriptor belongs to this experiment.
        let length = unsafe { libc::write(fd, bytes.as_ptr().cast(), bytes.len()) };
        if length < 0 && io::Error::last_os_error().kind() == io::ErrorKind::Interrupted {
            continue;
        }
        if length <= 0 {
            return Err(io::Error::last_os_error().into());
        }
        bytes = &bytes[length as usize..];
    }
    Ok(())
}

pub(super) fn allowlist(master: libc::c_int, checkpoint: libc::c_int) -> Result<()> {
    // SAFETY: getdtablesize has no memory arguments; fcntl validates each number.
    for fd in 3..unsafe { libc::getdtablesize() } {
        // SAFETY: these fcntl operations use integer flags, not pointers.
        unsafe {
            let flags = libc::fcntl(fd, libc::F_GETFD);
            if flags < 0 {
                continue;
            }
            let flags = if fd == master || fd == checkpoint {
                flags & !libc::FD_CLOEXEC
            } else {
                flags | libc::FD_CLOEXEC
            };
            if libc::fcntl(fd, libc::F_SETFD, flags) < 0 {
                return Err(io::Error::last_os_error().into());
            }
        }
    }
    Ok(())
}
