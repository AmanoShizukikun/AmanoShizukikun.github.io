// Content of the music player (/apps/music/). Used by the page (assets/js/pages/music.js), the build
// (src/pages/music.mjs) and the analyser (tools/music-scan.mjs).
//   id      file name and deep link: assets/music/<id>.mp3 · assets/img/music/<id>.webp · /apps/music/#<id>
//   year / bpm / genre   as written in the file's own tags (exported from Studio One)
//   sub     subtitle, as the track is titled on YouTube
//   video   the same track on YouTube
export const album = { title: '長門櫻', artist: '天野靜樹', made: 'Studio One' };

export const tracks = [
  {
    id: 'sakura-room', title: '長門桜の部屋', year: 2026, bpm: 93, genre: 'Chill',
    video: 'https://www.youtube.com/watch?v=qJOaBYOGxuk',
  },
  {
    id: 'dream-mirror', title: '夢界鏡廻', sub: 'Intro', year: 2025, bpm: 85,
    video: 'https://www.youtube.com/watch?v=xcnzCRhfVf8',
  },
];
