# File Viewer media fixture

`video.json` contains a one-second, silent 320×180 VP9 WebM with a solid blue frame. It has no external media source. Generate the clip with:

```sh
ffmpeg -f lavfi -i 'color=c=0x274b66:s=320x180:d=1:r=5' -c:v libvpx-vp9 -an demo.webm
```

Encode its bytes as base64 in the JSON `content` field. The separate unsupported-video scenario deliberately supplies invalid media bytes to exercise the production playback-unavailable message. Native media animation suppression belongs to the shared screenshot capture implementation, not the story fixtures.
