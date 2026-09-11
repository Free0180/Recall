# PET compatibility audio

Generated locally from the project vocabulary using the installed Microsoft Zira Desktop speech synthesizer (en-US). These are synthetic US English recordings, not British recordings or human narration. No paid API or external dictionary audio was used.

25 PCM WAV audio sprites (16 kHz, unsigned 8-bit mono) contain 2483 unique words, core examples and syllable strings. `src/pet/audio-index.json` maps each text to its file and cue times. Each clip has a 400 ms separation. Files are fetched on demand, not included in the initial PWA precache.
