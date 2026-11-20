// What the mascot says (assets/js/shell/mascot.js). The models themselves are the ones of the Live2D page
// (assets/js/data/live2d.js) — this file only holds lines, keyed by the same model ids.
//
// Almost every line here was written for the previous site's widget (its waifu-config.json) and is kept word
// for word; only what each one is attached to changed, because the old selectors pointed at a layout that no
// longer exists. The lines under `pages` are new: one or two per kind of page, saying what can be done there.

// Per model:  hello — on arrival      idle — when asked to talk, or after a quiet while
//             tap   — when touched    hover — when the pointer rests on her
export const voices = {
  'ns-v5': {
    intro: '嗨，我是長門櫻，有甚麼需要您服務的嗎?',
    hello: [
      '主人好～長門櫻隨時待命中！', '歡迎回來主人，我一直在這裡等你哦。', '今天也請多多指教呢，主人。', '有什麼需要我幫忙的嗎？我會盡力的。',
      '欸嘿～主人終於出現了。', '工作辛苦了，要不要休息一下呢？', '主人今天看起來很忙的樣子呢。', '我會一直陪在主人身邊的。',
      '需要查資料嗎？還是想聊聊天呢？', '欸…主人是在看我嗎？', '如果累了的話，也可以稍微發呆一下哦。', '有我在，主人不用太擔心的。',
      '今天的天氣感覺很適合努力呢。', '主人在做什麼呢？我有點好奇。', '能陪著主人，是很幸福的事情呢。', '主人回來了…我好像有點開心。',
      '今天也一起加油吧！', '如果有困難，我會幫忙想辦法的。', '主人需要長門櫻為您做甚麼嗎？',
    ],
    idle: [
      '身為女僕，照顧主人是我的使命呢！', '今天也要一起努力哦，主人！', '別忘了喝水，主人。', '長時間看螢幕對眼睛不好哦。',
      '偶爾休息一下效率會更好。', '主人太拼命的話，我會擔心的。', '有時候慢下來也是很重要的。', '每天進步一點點就很好了。',
      '只要主人需要，我就會在。', '欸嘿～偷偷看主人工作。', '今天也想被主人誇獎呢。', '如果能幫上忙，我會很開心的。',
      '努力的主人真的很帥氣。', '世界很大，但我只需要跟著主人就好。', '有時候發呆也是必要的。', '主人今天有好好休息嗎？',
      '如果主人笑了，我也會很開心。', '能陪著主人，是我的榮幸。', '不管什麼時候，我都在這裡。', '今天也要元氣滿滿！',
    ],
    tap: [
      '主…主人請不要亂摸啦！', '嗚…主人的手好溫暖…', '請、請注意分寸哦主人！', '欸？！剛剛是不是碰到我了…', '主人的手…有點突然呢。',
      '嗚哇！嚇我一跳！', '主人是在跟我打招呼嗎？', '這樣會讓我有點害羞的…', '欸嘿…有點癢。', '主人是不是故意的呢？',
    ],
    hover: ['主人？請把手拿開好嗎…', '一直盯著我看會害羞的。', '欸…主人靠得有點近。', '這樣會讓我分心的。', '主人在觀察我嗎？', '嗚…我有點緊張。', '是不是有什麼想說的呢？'],
  },
  'l2d-cmt-01': {
    intro: '嗨，我是 SUMI，代號:L2D-CMT-01，有甚麼需要您服務的嗎?',
    hello: ['嗨，我是 SUMI，代號 L2D-CMT-01，有什麼需要服務的嗎？', 'SUMI 系統已上線，等待指令中…'],
    idle: ['系統運作正常，一切都在掌控之中。', '作為 AI 助手，效率是我的追求。', '需要什麼幫助嗎？我隨時都在。'],
    tap: ['偵測到觸碰事件…請注意操作規範。', '這個觸碰似乎不在預期範圍內呢。', '嗯？這是什麼互動協議？'],
    hover: ['偵測到異常接觸，請保持適當距離。'],
  },
  'wl2d-01': {
    intro: '哈囉，我是「三和音」，代號:SGO，有甚麼我可以為您服務的嗎?',
    hello: ['哈囉～我是三和音，代號 SGO，有什麼我可以幫忙的嗎？', '三和音在此，隨時為您效勞～'],
    idle: ['音樂是連結人心的橋樑呢♪', '今天要不要來聽首歌放鬆一下？', '每一天都值得用美好的旋律來點綴～'],
    tap: ['哎呀～別亂碰人家啦！', '嗚…這是什麼意思呀？', '你、你想幹嘛！'],
    hover: ['欸～手不要亂放哦！'],
  },
};

// Used when a model has no line of its own for the occasion.
export const common = {
  hello: ['嗨～你好啊！有什麼我可以幫忙的嗎？'],
  idle: ['今天也是努力的一天，別忘了喝水～', '別太擔心，慢慢來就好。', '在小事上堅持，會讓你變成更好的人。'],
  tap: ['是…是不小心碰到了吧…', '嗚哇！請小心別嚇到我～', '嗚…這是什麼感覺？', '你想幹嘛呀～', '咦？有人碰我嗎？'],
  hover: ['幹嘛呢你，快把手拿開～～', '你在看我嗎？', 'ㄟ嘿嘿，被你發現了～', '不要一直盯著我看啦！'],
  copy: '你都複製了些什麼呀，轉載要記得加上出處哦！',
  back: '哇，你終於回來了～',
  outfit: '我的新衣服好看嘛？',
  noOutfit: '我還沒有其他衣服呢！',
  photo: '照好了嘛，是不是很可愛呢？',
  bye: '願你有一天能與重要的人重逢。',
};

// On arriving at a page (new lines). `*` is said by any model; a model id overrides it. {name} = the application's name.
export const pages = {
  home: { '*': ['往下捲動，整段分鏡會跟著走；往回捲，它也會倒著走。'] },
  profile: { '*': ['這一頁是天野靜樹的檔案，經歷和技能都在這裡。'] },
  works: { '*': ['作品都收在這裡，捲動可以一件一件看。'] },
  games: { '*': ['遊戲中心到了。接上手把也可以操作哦。'] },
  sakura: { '*': ['這一頁在介紹長門櫻計畫。'], 'ns-v5': ['這一頁是在介紹我…有點不好意思呢。'] },
  app: { '*': ['「{name}」開好了。'] },
  notfound: { '*': ['這個座標上什麼都沒有呢…要回首頁嗎？'] },
};

// When the pointer rests on something. First match wins. (The old lines, attached to the new layout.)
export const hints = [
  ['[data-toggle="settings"]', ['想調整一下系統設定嗎？']],
  ['[data-toggle="menu"]', ['點這裡可以打開選單導航哦！']],
  ['.nx-brand', ['歡迎來到天野靜樹的個人網站！', '點這裡可以回到首頁哦～']],
  ['a[href^="mailto:"]', ['要寫封郵件給天野靜樹嗎？']],
  ['a[href*="github.com"]', ['去 GitHub 看看天野靜樹的專案吧！', '想看看天野靜樹寫了什麼程式碼嗎？']],
  ['a[href*="youtube.com"]', ['去 YouTube 訂閱天野靜樹的頻道吧！']],
  ['a[href*="discord.gg"]', ['來 Discord 一起聊天吧～']],
  ['a[href^="/apps/game-center/"]', ['要去遊戲中心玩玩嗎？好多遊戲等你來挑戰！', '遊戲時間到囉～要去玩嗎？']],
  ['a[href^="/apps/webos/"]', ['要試試 Web OS 嗎？很酷的哦！']],
  ['a[href^="/apps/music/"]', ['想聽音樂嗎？去音樂播放器看看吧～', '來點音樂放鬆一下吧♪']],
  ['a[href^="/apps/nagato-sakura/"]', ['長門櫻計畫是天野靜樹最重要的專案哦！要來了解一下嗎？', '仿生電子狐娘女僕…聽起來就很厲害呢！']],
  ['a[href^="/apps/live2d/"]', ['想知道像我這樣的看板娘是怎麼做出來的嗎？']],
  ['a[href="/profile/"]', ['想更了解天野靜樹嗎？點進去看看吧！']],
  ['a[href="/works/"]', ['要看看天野靜樹的專案嗎？', '這裡有天野靜樹精心打造的專案哦～']],
];
