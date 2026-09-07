// Compile the selected OpenForge authority unchanged, without a Sidecar or PTYs.
// Unused worker APIs are expected in this isolated contract probe.
#[allow(dead_code, unused_imports)]
#[path = "../../../../../src-tauri/src/terminal_model.rs"]
mod terminal_model;

use terminal_model::{
    GhosttyTerminalModel, TerminalModel, TerminalModelOptions, TerminalModelSession,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cases: &[(&str, &[u8], &[u8])] = &[
        ("partial-csi", b"BEFORE\x1b[31", b"mRED"),
        ("partial-utf8", b"BEFORE\xf0\x9f", b"\x98\x80AFTER"),
        (
            "alternate-screen",
            b"PRIMARY\x1b[?1049hALT",
            b"\x1b[?1049lAFTER",
        ),
        ("partial-query", b"BEFORE\x1b[", b"6nAFTER"),
    ];
    let mut results = Vec::new();
    for (name, prefix, suffix) in cases {
        let options = TerminalModelOptions::new(80, 24);
        let mut original = GhosttyTerminalModel::new(options)?;
        original.feed(prefix)?;
        // The replacement checkpoint must drain accepted replies, not replay them.
        let accepted_replies = original.take_protocol_replies();
        let checkpoint = original.encode_snapshot()?;
        let mut restored = GhosttyTerminalModel::decode_snapshot(&checkpoint)?;
        let restored_initial_replies = restored.take_protocol_replies();
        original.feed(suffix)?;
        restored.feed(suffix)?;
        let original_replies = original.take_protocol_replies();
        let restored_replies = restored.take_protocol_replies();
        let codec_matches = original.format_portable_vt()? == restored.format_portable_vt()?
            && original_replies == restored_replies
            && restored_initial_replies.is_empty();

        // Exercise the production actor's actual presentation recovery payload.
        let (actor, feeder) = TerminalModelSession::start_with_event_sink(
            name.to_string(),
            1,
            TerminalModelOptions::new(80, 24),
            std::sync::Arc::new(|_| {}),
        )?;
        feeder.feed(prefix);
        let presentation = actor.portable_snapshot()?;
        results.push(serde_json::json!({
            "name": name,
            "prefix": prefix,
            "suffix": suffix,
            "checkpointBytes": checkpoint.len(),
            "codecMatches": codec_matches,
            "acceptedReplies": accepted_replies,
            "continuedReplies": original_replies,
            "watermark": presentation.watermark,
            "compatibilityData": presentation.compatibility_replay,
            "continuationData": presentation.continuation,
            "data": presentation.portable_vt,
        }));
    }
    println!("{}", serde_json::to_string(&results)?);
    Ok(())
}
