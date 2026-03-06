# Browser Anime Studio

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- A browser-based anime animation studio with a 960x540 canvas
- Background image upload (single file)
- Character image upload (multiple files)
- Drag-and-drop characters on canvas with mouse
- Keyboard arrow key movement for the first character
- Start/Stop animation loop controls
- Record canvas stream (30fps) and download as WebM video
- Dark-themed UI (#0e0e13 background, dark toolbar)

### Modify
N/A

### Remove
N/A

## Implementation Plan
- Backend: minimal Motoko actor (no persistent state needed for this app)
- Frontend:
  - Single-page React app with Canvas-based animation scene
  - Toolbar: background file input, character file input (multiple), Start, Stop, Record, Download Video buttons
  - Canvas: 960x540, draws background + characters each frame
  - Character class: holds image, x/y/w/h, draw method
  - Mouse events: mousedown to select character, mousemove to drag, mouseup to deselect
  - Keyboard events: ArrowLeft/Right/Up/Down to move first character
  - Record: use canvas.captureStream(30) + MediaRecorder to collect chunks
  - Download: stop recorder, blob to WebM, trigger download
  - Apply data-ocid markers on all interactive controls
