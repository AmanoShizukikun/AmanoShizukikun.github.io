// 長門櫻的日常 (/apps/ns-room/): everything the life simulation knows that is not code — her needs, what she can do
// and where, what each piece of furniture offers, and what she says. The page is assets/js/pages/room.js; the
// simulation assets/js/room/life.js reads this file. To add an activity: give it an entry in `activities`, list it
// under the furniture it belongs to, and (if it needs a new place to stand or sit) add the spot in room/room.js.
//
// Time is game time: one day is 1440 minutes; at 1× one game minute passes per real second.

// needs, 0–100. `decay` is lost per game hour while nothing restores it.
export const needs = [
  { id: 'energy', zh: '精力', decay: 4.5 },
  { id: 'fun', zh: '心情', decay: 6 },
  { id: 'social', zh: '陪伴', decay: 3.5 },
  { id: 'comfort', zh: '舒適', decay: 5 },
  { id: 'mind', zh: '求知', decay: 3 },
];

// what she does.
//   spot     where (room/room.js `spots`)               pose   how she holds herself there (room/poses.js)
//   gains    per game hour while doing it (a negative number costs)
//   until    stops when this need reaches 95 (otherwise when `max` minutes have passed)
//   min/max  game minutes                               hours  [from, to]: only offered to herself in these hours
//   prop     something she holds                         face   her expression while doing it
//   log      the diary line when she starts              lines  what she may say while doing it
export const activities = {
  sleep: {
    zh: '睡覺', spot: 'bedLie', pose: 'lie', gains: { energy: 13, comfort: 6 }, until: 'energy', min: 180, max: 600, hours: [21.5, 9],
    face: 'sleep', log: '鑽進被窩睡著了。', lines: ['晚安，主人……', '呼……', '嗯……再五分鐘……'],
  },
  nap: {
    zh: '小睡一下', spot: 'bedLie', pose: 'lie', gains: { energy: 10, comfort: 8 }, min: 20, max: 60,
    face: 'sleep', log: '在床上小睡了一會兒。', lines: ['眼睛……閉一下下就好……'],
  },
  laptop: {
    zh: '用筆電', spot: 'desk', pose: 'type', gains: { fun: 26, social: 14, mind: 6, energy: -2 }, min: 30, max: 120,
    face: 'smile', glow: 'laptop', log: '坐到書桌前打開了筆電。',
    lines: ['今天的留言好多！', '主人，這個影片你看過了嗎？', '幫主人整理的資料，已經分類好了喔。', '嘿嘿，偷偷看一下大家在聊什麼。'],
  },
  study: {
    zh: '寫筆記', spot: 'desk', pose: 'write', gains: { mind: 30, fun: -4, energy: -3 }, until: 'mind', min: 30, max: 90,
    face: 'focus', log: '攤開筆記本開始寫筆記。', lines: ['這裡要畫重點……', '嗯，原來是這樣！', '寫完這頁就休息。'],
  },
  read: {
    zh: '看書', spot: 'bedSit', pose: 'read', prop: 'book', gains: { fun: 18, mind: 16, comfort: 10 }, min: 30, max: 120,
    face: 'calm', fetch: 'shelf', log: '從書櫃抽了一本書，坐到床邊看。',
    lines: ['這本的結局……我還想再看一次。', '主角好帥氣……啊，沒、沒什麼！', '下一章、下一章！'],
  },
  hug: {
    zh: '抱抱枕', spot: 'bedSit', pose: 'hug', prop: 'plush', gains: { fun: 24, comfort: 18 }, min: 15, max: 45,
    face: 'joy', log: '抱著貓咪抱枕滾來滾去。', lines: ['軟綿綿的～', '這是我的貓貓，不給你喔。', '嘿嘿。'],
  },
  window: {
    zh: '看窗外', spot: 'bedKneel', pose: 'kneel', gains: { fun: 10, comfort: 8 }, min: 15, max: 40,
    face: 'calm', log: '跪坐在床上看著窗外。', lines: ['今天的天空好漂亮。', '外面的櫻花……開了呢。', '星星出來了。'],
  },
  stretch: {
    zh: '伸展', spot: 'rug', pose: 'stretch', gains: { fun: 10, comfort: 6, energy: 3 }, min: 10, max: 25,
    face: 'smile', log: '在地毯上伸了個大懶腰。', lines: ['嗯——！', '一、二、三、四……', '整個人都醒過來了！'],
  },
  tidy: {
    zh: '整理衣櫃', spot: 'wardrobe', pose: 'tidy', gains: { fun: 6, mind: 4, comfort: -2 }, min: 15, max: 35,
    face: 'calm', log: '打開衣櫃整理衣服。', lines: ['女僕裝要燙得平平整整。', '這件……好像有點小了？', '整齊多了！'],
  },
  idle: {
    zh: '發呆', spot: null, pose: 'stand', gains: {}, min: 4, max: 12,
    face: 'calm', lines: ['……', '主人在做什麼呢？', '嗯哼哼～'],
  },
};

// what the visitor (主人) can do with her: she stops what she is doing, turns to the camera and answers
export const interactions = {
  wave: { zh: '打招呼', pose: 'wave', minutes: 6, gains: { social: 10, fun: 3 }, face: 'joy', lines: ['主人！歡迎回來～', '啊，主人！我在這裡！', '嗨嗨～今天也辛苦了！'] },
  pat: { zh: '摸摸頭', pose: 'pat', minutes: 10, gains: { social: 15, fun: 8 }, face: 'bliss', lines: ['欸、欸嘿嘿……', '再、再一下下就好……', '主人的手好溫暖。'] },
  talk: { zh: '聊天', pose: 'talk', minutes: 20, gains: { social: 24, fun: 6 }, face: 'smile', lines: ['跟主人說喔，今天書櫃那本書我看完了！', '主人今天吃飯了嗎？不可以只喝咖啡喔。', '如果主人累了，就在這裡休息一下吧。', '我在想，下次要把房間佈置成什麼樣子呢？'] },
  rest: { zh: '叫她去休息', queue: 'sleep', lines: ['好～那我先睡囉，主人也早點休息。'] },
};

// what each piece of furniture offers when it is clicked (the menu lists them in this order)
export const furniture = {
  bed: { zh: '床', actions: ['sleep', 'nap', 'hug', 'read', 'window'] },
  desk: { zh: '書桌', actions: ['laptop', 'study'] },
  shelf: { zh: '書櫃', actions: ['read'] },
  wardrobe: { zh: '衣櫃', actions: ['tidy'] },
  rug: { zh: '地毯', actions: ['stretch'] },
  window: { zh: '窗戶', actions: ['window'] },
};

// parts of the day, for the clock and for the lines below
export const dayparts = [
  { from: 5, zh: '清晨' }, { from: 8, zh: '早上' }, { from: 11, zh: '中午' }, { from: 13.5, zh: '下午' },
  { from: 17, zh: '傍晚' }, { from: 19, zh: '晚上' }, { from: 23, zh: '深夜' },
];

// lines that belong to a moment rather than an activity
export const lines = {
  wake: ['早安，主人！今天也一起加油吧！', '呼啊……早安……', '睡得好飽～'],
  tired: ['好睏……', '眼皮好重……'],
  bored: ['好無聊喔……', '主人，陪我玩嘛。'],
  lonely: ['主人……還在嗎？', '一個人好安靜喔。'],
  welcome: ['主人來了！', '歡迎回來，主人。'],
};
