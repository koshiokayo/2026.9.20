'use strict';

/* =========================================================
   共通
   ========================================================= */
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#e2682a', '#2e9e5b', '#2f6fd0', '#8a5a3b'];
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 120) : ms));

function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* 箱型のノードを描く */
function drawNode(layer, node, opts = {}) {
  const w = node.w || 120, h = 52;
  const g = el('g', { class: opts.clickable ? 'nd-hit' : '', tabindex: opts.clickable ? 0 : null }, layer);
  if (!opts.clickable) g.removeAttribute('tabindex');
  const box = el('rect', {
    x: node.x - w / 2, y: node.y - h / 2, width: w, height: h, rx: node.round || 7,
    class: 'nd-box' + (node.kind ? ' ' + node.kind : '')
  }, g);
  const dark = node.kind === 'dev';
  el('text', { x: node.x, y: node.y - 1, class: 'nd-label' + (dark ? ' on-dark' : '') }, g).textContent = node.name;
  if (node.sub) {
    el('text', { x: node.x, y: node.y + 15, class: 'nd-sub' + (dark ? ' on-dark' : '') }, g).textContent = node.sub;
  }
  g.dataset.id = node.id;
  node.el = g; node.box = box;
  return g;
}

/* パスに沿って粒を動かす */
function flyPacket(layer, pathEl, { color = '#e2682a', label = '', dur = 900, reverse = false } = {}) {
  return new Promise((resolve) => {
    const len = pathEl.getTotalLength();
    const g = el('g', {}, layer);
    el('circle', { r: 9, fill: color, class: 'fly-dot' }, g);
    if (label) el('text', { y: -15, class: 'fly-tag' }, g).textContent = label;
    const total = reduceMotion ? 200 : dur;
    const start = performance.now();
    function step(now) {
      let t = Math.min(1, (now - start) / total);
      const p = pathEl.getPointAtLength((reverse ? 1 - t : t) * len);
      g.setAttribute('transform', `translate(${p.x},${p.y})`);
      if (t < 1) { requestAnimationFrame(step); }
      else { g.remove(); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

function flash(node, ms = 600) {
  node.el.classList.add('nd-flash');
  setTimeout(() => node.el.classList.remove('nd-flash'), ms);
}

function showX(layer, node) {
  const t = el('text', { x: node.x, y: node.y - 34, class: 'drop-x' }, layer);
  t.textContent = '✕ 破棄';
  setTimeout(() => t.remove(), 1600);
}

/* =========================================================
   タブ切りかえ
   ========================================================= */
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('is-active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('is-active');
  });
});

/* ポートLEDの点滅（機器の前面パネルらしさ） */
(function ledLoop() {
  const ports = [...document.querySelectorAll('.port')];
  if (!ports.length || reduceMotion) { ports.forEach((p, i) => { if (i % 3 === 0) p.classList.add('lit'); }); return; }
  setInterval(() => {
    ports.forEach((p) => p.classList.toggle('lit', Math.random() < 0.45));
  }, 700);
})();

/* =========================================================
   1. つながり方
   ========================================================= */
const MAP_NODES = [
  { id: 'pcA', x: 90, y: 70, name: 'パソコンA', sub: '192.168.1.10' },
  { id: 'pcB', x: 90, y: 180, name: 'パソコンB', sub: '192.168.1.11' },
  { id: 'pcC', x: 90, y: 290, name: 'パソコンC', sub: '192.168.1.12' },
  { id: 'sw', x: 300, y: 180, name: 'スイッチングハブ', sub: 'LAN内を仕分け', kind: 'dev' },
  { id: 'rt', x: 500, y: 180, name: 'ルータ', sub: '外と中の境目', kind: 'dev' },
  { id: 'onu', x: 660, y: 180, name: 'ONU / モデム', sub: '信号の変換', kind: 'dev' },
  { id: 'net', x: 820, y: 180, name: 'インターネット', sub: 'WAN', kind: 'net', round: 24 },
  { id: 'ap', x: 400, y: 350, name: 'アクセスポイント', sub: '無線LANの入口', kind: 'dev' },
  { id: 'ph', x: 180, y: 400, name: 'タブレット', sub: '192.168.1.30' }
];
const MAP_LINKS = [
  { id: 'pcA-sw', d: 'M150 70 H195 V180 H240' },
  { id: 'pcB-sw', d: 'M150 180 H240' },
  { id: 'pcC-sw', d: 'M150 290 H195 V180 H240' },
  { id: 'sw-rt', d: 'M360 180 H440' },
  { id: 'rt-onu', d: 'M560 180 H600' },
  { id: 'onu-net', d: 'M720 180 H760' },
  { id: 'rt-ap', d: 'M500 206 V265 H400 V324' },
  { id: 'ap-ph', d: 'M340 350 H290 V400 H240', wifi: true }
];
const DEVICE_INFO = {
  pcA: { role: 'ネットワークにつながる機器（ノード）です。LANケーブルをさすためのNIC（ネットワークインタフェースカード）を内蔵しています。', spec: { 'IPアドレス': '192.168.1.10', 'MACアドレス': '00-1A-2B-00-00-0A', '役割': 'データを作って送る／受け取る' } },
  pcB: { role: 'パソコンAと同じLANの中にいます。同じLAN内どうしなら、ルータを通らずにスイッチだけで通信できます。', spec: { 'IPアドレス': '192.168.1.11', 'MACアドレス': '00-1A-2B-00-00-0B' } },
  pcC: { role: 'パソコンAと同じLANの中にいます。宛先が同じネットワーク内かどうかは、IPアドレスの前半（ネットワーク部）で見分けます。', spec: { 'IPアドレス': '192.168.1.12', 'MACアドレス': '00-1A-2B-00-00-0C' } },
  sw: { role: 'LANの中で機器どうしをつなぐ機器です。届いたデータの宛先MACアドレスを見て、必要なポートにだけ送り出します。むだな通信が流れないので速く、安全です。', spec: { '見ている宛名': 'MACアドレス', '配り方': '宛先のポートだけ', 'つなぐ範囲': '同じLANの中' } },
  rt: { role: '異なるネットワークどうしをつなぐ機器です。宛先IPアドレスを見て、LANの外へ出すか中で済ませるかを判断し、経路を選んで転送します（ルーティング）。家庭用ではAP機能も一体になっていることが多いです。', spec: { '見ている宛名': 'IPアドレス', '配り方': '次に渡すべき相手へ', 'つなぐ範囲': 'LAN と WAN の間' } },
  onu: { role: '光ファイバの光信号と、機器が扱う電気信号を相互に変換する装置です。ADSLや同軸ケーブルの回線ではモデムやケーブルモデムが同じ役目をします。', spec: { '役割': '信号の形式を変換', '設置場所': '回線の引き込み口' } },
  net: { role: '世界中のネットワークがつながった巨大なネットワークです。多くのルータがバケツリレーのようにパケットを中継して、目的のサーバまで運びます。', spec: { '正体': 'ネットワークのネットワーク', '住所': 'グローバルIPアドレス' } },
  ap: { role: '無線LAN（Wi-Fi）で機器をLANに参加させる機器です。電波が届く範囲であればケーブルなしでつながりますが、同じ電波を共有するので混みあうと遅くなります。', spec: { '通信の方法': '電波（無線）', '見分ける名前': 'SSID', '守るしくみ': 'WPA2 / WPA3 による暗号化' } },
  ph: { role: '無線でLANに参加している機器です。有線でも無線でも、IPアドレスを持ってパケットをやりとりするしくみは同じです。', spec: { 'IPアドレス': '192.168.1.30', '接続': '無線LAN' } }
};

const mapLinkEls = {};
(function buildMap() {
  const linkLayer = document.getElementById('mapLinks');
  const nodeLayer = document.getElementById('mapNodes');
  MAP_LINKS.forEach((l) => {
    mapLinkEls[l.id] = el('path', { d: l.d, class: 'lk' + (l.wifi ? ' wifi' : '') }, linkLayer);
  });
  MAP_NODES.forEach((n) => {
    if (n.id === 'sw' || n.id === 'ap' || n.id === 'onu') n.w = 150;
    if (n.id === 'net') n.w = 140;
    const g = drawNode(nodeLayer, n, { clickable: true });
    const pick = () => selectDevice(n.id);
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
})();

function selectDevice(id) {
  MAP_NODES.forEach((n) => n.box.classList.toggle('sel', n.id === id));
  const n = MAP_NODES.find((x) => x.id === id);
  const info = DEVICE_INFO[id];
  document.getElementById('mapDetailName').textContent = n.name;
  document.getElementById('mapDetailRole').textContent = info.role;
  const dl = document.getElementById('mapDetailSpec');
  dl.innerHTML = '';
  for (const k in info.spec) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = info.spec[k];
    dl.append(dt, dd);
  }
}
selectDevice('sw');

document.getElementById('mapSend').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const fly = document.getElementById('mapFly');
  const hint = document.getElementById('mapHint');
  const route = [
    ['pcA-sw', 'スイッチへ', 'sw'],
    ['sw-rt', 'ルータへ', 'rt'],
    ['rt-onu', 'ONUへ', 'onu'],
    ['onu-net', '外の世界へ', 'net']
  ];
  const texts = [
    'パソコンAがデータをパケットに分け、ヘッダを付けて送り出しました。',
    'スイッチは宛先を見て、ルータ側のポートへ送りました。',
    'ルータは宛先IPがLANの外だと判断し、インターネット側へ転送します。',
    'ONUが電気信号を光信号に変えて、回線へ送り出しました。'
  ];
  for (let i = 0; i < route.length; i++) {
    hint.textContent = texts[i];
    await flyPacket(fly, mapLinkEls[route[i][0]], { color: COLORS[i % 4], label: 'データ', dur: 850 });
    flash(MAP_NODES.find((n) => n.id === route[i][2]));
    await wait(200);
  }
  hint.textContent = 'インターネット上のサーバに届きました。返事は同じ道を逆にたどってきます。';
  btn.disabled = false;
});

/* =========================================================
   2. データを分ける
   ========================================================= */
const srcText = document.getElementById('srcText');
const sizeRange = document.getElementById('sizeRange');
const sizeView = document.getElementById('sizeView');
const headerOn = document.getElementById('headerOn');
const madeList = document.getElementById('madeList');
const gotList = document.getElementById('gotList');
const rebuildBtn = document.getElementById('rebuild');
const rebuildResult = document.getElementById('rebuildResult');
let arrived = [];

sizeRange.addEventListener('input', () => { sizeView.textContent = sizeRange.value; });

function packetCard(pk, opts = {}) {
  const div = document.createElement('div');
  div.className = 'pk pk--c' + (pk.seq % 4);
  if (pk.withHeader) {
    const h = document.createElement('div');
    h.className = 'pk__head';
    h.innerHTML =
      '宛先 IP&nbsp;&nbsp;203.0.113.5<br>' +
      '送信元 IP&nbsp;192.168.1.10<br>' +
      '通し番号&nbsp;<span class="pk__no">' + (pk.seq + 1) + ' / ' + pk.total + '</span>';
    div.appendChild(h);
  } else {
    const h = document.createElement('div');
    h.className = 'pk__head';
    h.innerHTML = 'ヘッダなし<br>宛先も順番も<br>わからない';
    div.appendChild(h);
  }
  const d = document.createElement('div');
  d.className = 'pk__data';
  d.textContent = pk.data;
  div.appendChild(d);
  if (opts.dim) div.classList.add('pk--drop');
  return div;
}

document.getElementById('sendPackets').addEventListener('click', async () => {
  const text = srcText.value.trim();
  madeList.innerHTML = ''; gotList.innerHTML = '';
  rebuildResult.innerHTML = ''; rebuildBtn.disabled = true;
  if (!text) { rebuildResult.innerHTML = '<span class="ng">送りたいデータを入力してください。</span>'; return; }

  const size = Number(sizeRange.value);
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  const withHeader = headerOn.checked;
  const packets = chunks.map((c, i) => ({ seq: i, total: chunks.length, data: c, withHeader }));

  for (const pk of packets) { madeList.appendChild(packetCard(pk)); await wait(180); }

  arrived = packets.slice();
  // 届く順番を入れかえる（回線の混み具合で順序は変わる）
  for (let i = arrived.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrived[i], arrived[j]] = [arrived[j], arrived[i]];
  }
  for (const pk of arrived) { gotList.appendChild(packetCard(pk)); await wait(260); }
  rebuildBtn.disabled = false;
  rebuildResult.textContent = '全部届きました。元に戻せるか試しましょう。';
});

rebuildBtn.addEventListener('click', () => {
  if (!arrived.length) return;
  const useHeader = arrived[0].withHeader;
  const order = useHeader ? arrived.slice().sort((a, b) => a.seq - b.seq) : arrived;
  const joined = order.map((p) => p.data).join('');
  const ok = joined === srcText.value.trim();
  rebuildResult.innerHTML = '組み立てた結果：<b>' + joined + '</b><br>' +
    (ok
      ? '<span class="ok">成功。ヘッダの通し番号のおかげで、届いた順がバラバラでも正しく並べ直せました。</span>'
      : '<span class="ng">失敗。ヘッダがないと順番がわからないので、届いた順につなぐしかなく、意味が通らなくなります。</span>');
});

/* =========================================================
   3. 機器の動き
   ========================================================= */
const DEV_NODES = {
  pcA: { id: 'pcA', x: 90, y: 80, name: 'パソコンA', sub: 'ポート1' },
  pcB: { id: 'pcB', x: 90, y: 210, name: 'パソコンB', sub: 'ポート2' },
  pcC: { id: 'pcC', x: 90, y: 340, name: 'パソコンC', sub: 'ポート3' },
  dev: { id: 'dev', x: 380, y: 210, name: 'リピータハブ', sub: '全ポートへ中継', kind: 'dev', w: 170 },
  net: { id: 'net', x: 650, y: 210, name: 'インターネット', sub: 'WAN', kind: 'net', w: 140, round: 24 }
};
const DEV_LINKS = {
  'pcA-dev': 'M150 80 H240 V210 H295',
  'pcB-dev': 'M150 210 H295',
  'pcC-dev': 'M150 340 H240 V210 H295',
  'dev-net': 'M465 210 H580'
};
const devLinkEls = {};
let devMode = 'hub';
let macTable = {};   // ポート -> MAC
let sendCount = 0;

const MACS = { pcA: '00-1A-2B-00-00-0A', pcB: '00-1A-2B-00-00-0B', pcC: '00-1A-2B-00-00-0C' };
const PORTS = { pcA: 'ポート1', pcB: 'ポート2', pcC: 'ポート3' };

(function buildDev() {
  const linkLayer = document.getElementById('devLinks');
  const nodeLayer = document.getElementById('devNodes');
  for (const k in DEV_LINKS) devLinkEls[k] = el('path', { d: DEV_LINKS[k], class: 'lk' }, linkLayer);
  for (const k in DEV_NODES) drawNode(nodeLayer, DEV_NODES[k]);
})();

const DEV_TEXT = {
  hub: {
    title: 'リピータハブ',
    sub: '全ポートへ中継',
    hint: 'ハブは宛名を読みません。',
    note: '<h3>リピータハブ</h3><p>届いた信号を、<b>送られてきたポート以外のすべてのポート</b>にそのまま流します。宛名を読まないので作りは単純ですが、関係のない機器にもデータが届くため、<b>回線がむだに混み</b>、盗み見される危険もあります。今はほとんど使われていません。</p>',
    table: false
  },
  switch: {
    title: 'スイッチングハブ',
    sub: 'MACアドレスで仕分け',
    hint: '最初は相手の場所を知りません。',
    note: '<h3>スイッチングハブ</h3><p>データの<b>宛先MACアドレス</b>を読み、どのポートの先にどの機器がいるかを記録した<b>MACアドレステーブル</b>を見て、必要な1つのポートにだけ送ります。表にない宛先のときだけ、全ポートに送って相手をさがします（フラッディング）。送信元のMACアドレスは受け取るたびに自動で覚えます。</p>',
    table: true
  },
  router: {
    title: 'ルータ',
    sub: 'IPアドレスで経路選択',
    hint: '宛先は別のネットワークです。',
    note: '<h3>ルータ</h3><p>宛先<b>IPアドレス</b>を見て、そのパケットを<b>どのネットワークへ渡すか</b>を決めます。同じLAN内ならスイッチに任せ、外向きならインターネット側へ転送します。判断のもとになるのが<b>ルーティングテーブル（経路表）</b>です。家庭では、外向きの通信のときにプライベートIPアドレスをグローバルIPアドレスに変換する役目（NAT）も担います。</p>',
    table: false
  }
};

function setDevMode(mode) {
  devMode = mode;
  macTable = {}; sendCount = 0;
  document.querySelectorAll('.seg__btn').forEach((b) => b.classList.toggle('is-on', b.dataset.dev === mode));
  const t = DEV_TEXT[mode];
  const dev = DEV_NODES.dev;
  dev.el.querySelector('.nd-label').textContent = t.title;
  dev.el.querySelector('.nd-sub').textContent = t.sub;
  document.getElementById('devNote').innerHTML = t.note;
  document.getElementById('devHint').textContent = t.hint;
  document.getElementById('devLog').innerHTML = '';
  document.getElementById('tableTitle').textContent = mode === 'router' ? 'ルーティングテーブル（簡略）' : 'MACアドレステーブル';
  document.getElementById('tableHint').textContent = t.table
    ? 'スイッチが自分で書き込んでいく表です。'
    : (mode === 'router' ? 'ルータはIPアドレスの範囲ごとに送り先を決めます。' : 'リピータハブはこの表を持ちません。');
  document.getElementById('devSend').textContent =
    mode === 'router' ? 'パソコンAからインターネットへ送信' : 'パソコンAからパソコンCへ送信';
  drawTable();
}

function drawTable() {
  const body = document.getElementById('macBody');
  body.innerHTML = '';
  const rows = [];
  if (devMode === 'switch') {
    for (const p of ['ポート1', 'ポート2', 'ポート3']) rows.push([p, macTable[p] || '（未学習）']);
  } else if (devMode === 'router') {
    rows.push(['192.168.1.0/24', 'LAN側へ']);
    rows.push(['その他すべて', 'インターネット側へ']);
  } else {
    rows.push(['—', '表を持たない']);
  }
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    r.forEach((c) => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
    body.appendChild(tr);
  });
}

function log(msg, cls) {
  const li = document.createElement('li');
  li.textContent = msg;
  if (cls) li.className = cls;
  document.getElementById('devLog').appendChild(li);
}

document.querySelectorAll('.seg__btn').forEach((b) => {
  b.addEventListener('click', () => setDevMode(b.dataset.dev));
});
document.getElementById('devReset').addEventListener('click', () => setDevMode(devMode));

document.getElementById('devSend').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const fly = document.getElementById('devFly');
  document.getElementById('devLog').innerHTML = '';
  sendCount++;

  if (devMode === 'hub') {
    log('パソコンA：宛先MAC ' + MACS.pcC + ' のデータを送信。');
    await flyPacket(fly, devLinkEls['pcA-dev'], { color: COLORS[0], label: 'C宛', dur: 800 });
    flash(DEV_NODES.dev);
    log('ハブ：宛名を読まず、ほかのすべてのポートへそのまま流す。');
    await Promise.all([
      flyPacket(fly, devLinkEls['pcB-dev'], { color: COLORS[0], label: 'C宛', dur: 800, reverse: true }),
      flyPacket(fly, devLinkEls['pcC-dev'], { color: COLORS[0], label: 'C宛', dur: 800, reverse: true })
    ]);
    showX(fly, DEV_NODES.pcB);
    log('パソコンB：自分宛ではないので受け取らずに破棄。むだな通信が発生した。', 'bad');
    flash(DEV_NODES.pcC, 1200);
    log('パソコンC：自分宛なので受信。通信は成功。', 'good');

  } else if (devMode === 'switch') {
    log('パソコンA：宛先MAC ' + MACS.pcC + ' のデータを送信。');
    await flyPacket(fly, devLinkEls['pcA-dev'], { color: COLORS[2], label: 'C宛', dur: 800 });
    flash(DEV_NODES.dev);
    macTable[PORTS.pcA] = MACS.pcA; drawTable();
    log('スイッチ：送信元を見て「ポート1にパソコンAがいる」と学習。');
    const known = Object.values(macTable).includes(MACS.pcC);
    if (!known) {
      log('スイッチ：宛先MACが表にない。全ポートへ送ってさがす（フラッディング）。', 'bad');
      await Promise.all([
        flyPacket(fly, devLinkEls['pcB-dev'], { color: COLORS[2], label: 'C宛', dur: 800, reverse: true }),
        flyPacket(fly, devLinkEls['pcC-dev'], { color: COLORS[2], label: 'C宛', dur: 800, reverse: true })
      ]);
      showX(fly, DEV_NODES.pcB);
      log('パソコンB：自分宛ではないので破棄。');
    } else {
      log('スイッチ：宛先MACは表にある。ポート3だけへ送る。', 'good');
      await flyPacket(fly, devLinkEls['pcC-dev'], { color: COLORS[2], label: 'C宛', dur: 800, reverse: true });
      log('パソコンB：データが流れてこない。回線がむだにならない。', 'good');
    }
    flash(DEV_NODES.pcC, 1200);
    log('パソコンC：受信して返事を送る。');
    await flyPacket(fly, devLinkEls['pcC-dev'], { color: COLORS[1], label: '返事', dur: 700 });
    macTable[PORTS.pcC] = MACS.pcC; drawTable();
    log('スイッチ：返事から「ポート3にパソコンCがいる」と学習。次からは1本だけで届く。', 'good');
    document.getElementById('devHint').textContent = 'もう一度「送信」を押すと、学習後の動きになります。';

  } else {
    log('パソコンA：宛先IP 203.0.113.5 のデータを送信。');
    log('パソコンA：宛先が自分と別のネットワークなので、まずルータへ渡す。');
    await flyPacket(fly, devLinkEls['pcA-dev'], { color: COLORS[3], label: '外宛', dur: 800 });
    flash(DEV_NODES.dev);
    log('ルータ：宛先IPを経路表と照合。192.168.1.0/24 以外なのでインターネット側へ転送。');
    await flyPacket(fly, devLinkEls['dev-net'], { color: COLORS[3], label: '外宛', dur: 900 });
    flash(DEV_NODES.net, 1200);
    log('インターネット：たくさんのルータが中継して、目的のサーバまで運ぶ。', 'good');
    document.getElementById('devHint').textContent = '宛先が同じLAN内なら、ルータを通らずスイッチだけで届きます。';
  }
  btn.disabled = false;
});

setDevMode('hub');

/* =========================================================
   4. 確認テスト
   ========================================================= */
const QUIZ = [
  {
    q: '学校や家庭など、限られた範囲の中でつくられたネットワークを何といいますか。',
    o: ['LAN', 'WAN', 'URL', 'OS'],
    a: 0,
    e: 'LAN（Local Area Network）です。LANどうしを広い範囲でつないだものがWANです。'
  },
  {
    q: 'データを送るときに、小さく分けられたひとまとまりを何といいますか。',
    o: ['ファイル', 'パケット', 'ビット', 'フォルダ'],
    a: 1,
    e: 'パケットです。小さく分けることで、1台が回線を占有せず多くの通信を同時に流せます。'
  },
  {
    q: 'パケットの先頭に付けられる、宛先や通し番号などの情報を何といいますか。',
    o: ['ヘッダ', 'アイコン', 'パスワード', 'タイトル'],
    a: 0,
    e: 'ヘッダです。荷物の送り状にあたり、宛先IPアドレス・送信元IPアドレス・通し番号などが入ります。'
  },
  {
    q: 'パケットが送った順とちがう順番で届いても、元のデータに戻せるのはなぜですか。',
    o: ['データが小さいから', 'ヘッダに通し番号があるから', '回線が速いから', 'パケットが自動で並ぶから'],
    a: 1,
    e: '通し番号があるので、受信側は番号順に並べ直して組み立てられます。'
  },
  {
    q: '届いたデータを、送られてきたポート以外のすべてのポートに流してしまう機器はどれですか。',
    o: ['ルータ', 'スイッチングハブ', 'リピータハブ', 'ONU'],
    a: 2,
    e: 'リピータハブです。宛名を読まないため、関係のない機器にもデータが流れます。'
  },
  {
    q: 'スイッチングハブが、送り先のポートを決めるときに見ている情報はどれですか。',
    o: ['MACアドレス', 'パスワード', 'ファイル名', 'SSID'],
    a: 0,
    e: '宛先MACアドレスです。どのポートの先にどの機器がいるかをMACアドレステーブルに記録して仕分けます。'
  },
  {
    q: '異なるネットワークどうしをつなぎ、IPアドレスを見て転送先を決める機器はどれですか。',
    o: ['アクセスポイント', 'ルータ', 'リピータハブ', 'NIC'],
    a: 1,
    e: 'ルータです。経路を選んで転送するはたらきをルーティングといいます。'
  },
  {
    q: '無線LANで機器をネットワークに参加させる機器と、その電波の名前の組み合わせで正しいものはどれですか。',
    o: ['ONU と IPアドレス', 'アクセスポイント と SSID', 'ルータ と MACアドレス', 'ハブ と URL'],
    a: 1,
    e: 'アクセスポイントが無線の入口で、電波を見分ける名前がSSIDです。通信内容はWPA2やWPA3で暗号化します。'
  }
];

function buildQuiz() {
  const list = document.getElementById('quizList');
  list.innerHTML = '';
  let correct = 0;
  const done = new Array(QUIZ.length).fill(false);
  const scoreEl = document.getElementById('score');
  scoreEl.textContent = '正解 0 / ' + QUIZ.length;

  QUIZ.forEach((item, qi) => {
    const box = document.createElement('div');
    box.className = 'q';
    const head = document.createElement('div');
    head.className = 'q__q';
    head.innerHTML = '<span>Q' + (qi + 1) + '</span>' + item.q;
    box.appendChild(head);

    const opts = document.createElement('div');
    opts.className = 'q__opts';
    const exp = document.createElement('div');
    exp.className = 'q__exp';
    exp.hidden = true;

    item.o.forEach((text, oi) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.textContent = text;
      b.addEventListener('click', () => {
        if (done[qi]) return;
        done[qi] = true;
        [...opts.children].forEach((c, ci) => {
          c.disabled = true;
          if (ci === item.a) c.classList.add('right');
          else if (ci === oi) c.classList.add('wrong');
        });
        if (oi === item.a) correct++;
        exp.textContent = (oi === item.a ? '正解。' : '答えは「' + item.o[item.a] + '」。') + item.e;
        exp.hidden = false;
        scoreEl.textContent = '正解 ' + correct + ' / ' + QUIZ.length;
      });
      opts.appendChild(b);
    });
    box.append(opts, exp);
    list.appendChild(box);
  });
}
buildQuiz();
document.getElementById('quizReset').addEventListener('click', buildQuiz);
