const { createApp, ref, onMounted, onBeforeUnmount, nextTick, watch, computed } = Vue

const NAMES = ['阿茶','小满','夜航船','三七','拾光','南屿','木子','青柠','折耳','白鹭',
  '子夜','川流','山有木','冷杉','橘子汽水','半糖','阿柚','星野','一寸灰','雾岛']
const TEXTS = ['这个转场绝了','已三连','前排打卡','背景音乐叫什么','笑不活了',
  '看了三遍还想看','求教程','这也太治愈了吧','收藏了慢慢看','UP主更新好快',
  '第一次见到这种拍法','有被惊艳到','下饭视频+1','这剪辑太丝滑了','蹲一个续集',
  '画面好干净','深夜刷到停不下来','建议做成系列','已经在等更新了','谁懂啊我哭了']
const COLORS = ['#fb7299','#00a1d6','#7c4dff','#f6a623','#2ecc71','#e74c3c','#1abc9c','#9b59b6']
const REPLIES = ['+1','同感','哈哈哈哈','确实','我也觉得','顶','说得好','太真实了','我猜也是','awsl']

function rng(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function pick(r, arr) { return arr[Math.floor(r() * arr.length)] }
function num(r, min, max) { return Math.floor(r() * (max - min + 1)) + min }

function genStats(id) {
  const r = rng('stat:' + id)
  return { likes: num(r, 120, 98000), comments: num(r, 6, 240) }
}

function genComments(id, count) {
  const r = rng('cmt:' + id)
  const total = Math.min(count, 20)
  const out = []
  for (let i = 0; i < total; i++) {
    const name = pick(r, NAMES) + (r() > 0.6 ? num(r, 1, 99) : '')
    const replies = []
    if (r() > 0.62) {
      const n = num(r, 1, 2)
      for (let j = 0; j < n; j++) {
        replies.push({ id: i + '-' + j, name: pick(r, NAMES), text: pick(r, REPLIES) })
      }
    }
    out.push({
      id: id + '-' + i,
      name,
      text: pick(r, TEXTS),
      color: pick(r, COLORS),
      ago: num(r, 1, 59) + pick(r, ['分钟前', '小时前', '天前']),
      likes: num(r, 0, 2400),
      replies
    })
  }
  return out
}

function fmt(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  return String(n)
}

createApp({
  setup() {
    const list = ref([])
    const paused = ref(-1)
    const liked = ref({})
    const muted = ref(true)
    const msg = ref('加载中…')
    const sheet = ref(-1)
    const extra = ref({})
    const cmtLiked = ref({})
    let observer = null

    const allVideos = () => Array.from(document.querySelectorAll('.slide video'))

    const statsOf = (v) => {
      const base = genStats(v.id)
      return {
        likes: base.likes + (liked.value[v.id] ? 1 : 0),
        comments: base.comments + (extra.value[v.id] ? extra.value[v.id].length : 0)
      }
    }

    const commentsOf = (v) => {
      const base = genComments(v.id, genStats(v.id).comments)
      return [...(extra.value[v.id] || []), ...base]
    }

    const playOnly = (index) => {
      allVideos().forEach((el, i) => {
        if (i === index) { el.muted = muted.value; el.play().catch(() => {}) }
        else el.pause()
      })
      paused.value = -1
    }

    const toggle = (index) => {
      const el = allVideos()[index]
      if (!el) return
      if (el.paused) { el.play().catch(() => {}); paused.value = -1 }
      else { el.pause(); paused.value = index }
    }

    const toggleLike = (v) => {
      liked.value = { ...liked.value, [v.id]: !liked.value[v.id] }
    }

    const openSheet = (i) => {
      sheet.value = i
      const el = allVideos()[i]
      if (el) el.pause()
    }
    const closeSheet = () => {
      sheet.value = -1
      if (paused.value === -1) playOnly(currentIndex())
    }

    const currentIndex = () => {
      let idx = 0
      allVideos().forEach((el, i) => {
        const r = el.getBoundingClientRect()
        if (Math.abs(r.top) < window.innerHeight / 2) idx = i
      })
      return idx
    }

    const send = (v, text) => {
      const t = text.trim()
      if (!t) return
      const mine = { id: 'me-' + Date.now(), name: '我', text: t, color: '#fb7299', ago: '刚刚', likes: 0, replies: [] }
      extra.value = { ...extra.value, [v.id]: [mine, ...(extra.value[v.id] || [])] }
    }

    const likeComment = (cid) => {
      cmtLiked.value = { ...cmtLiked.value, [cid]: !cmtLiked.value[cid] }
    }

    watch(muted, (value) => allVideos().forEach((el) => { el.muted = value }))

    onMounted(async () => {
      try {
        const res = await fetch('videos.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        list.value = Array.isArray(data) ? data : []
        msg.value = list.value.length ? '' : (window.EMPTY_TIP || '暂无视频')
      } catch (err) {
        msg.value = '加载失败：' + err.message
      }

      await nextTick()

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.6 && sheet.value === -1) {
            playOnly(Number(entry.target.dataset.index))
          }
        })
      }, { threshold: [0, 0.6, 1] })
      document.querySelectorAll('.slide').forEach((el) => observer.observe(el))
    })

    onBeforeUnmount(() => { if (observer) observer.disconnect() })

    return { list, paused, liked, muted, msg, sheet, extra, cmtLiked,
      statsOf, commentsOf, fmt, toggle, toggleLike, openSheet, closeSheet, send, likeComment }
  },

  template: `
  <div class="app">
    <div class="feed">
      <section class="slide" v-for="(v, i) in list" :key="v.id" :data-index="i" @click="toggle(i)">
        <video :src="v.url" :poster="v.cover || ''" playsinline webkit-playsinline muted loop preload="metadata"></video>
        <div class="mask"></div>
        <div class="pause" v-if="paused === i"><i></i></div>
        <div class="info">
          <div class="author">@{{ v.author }}</div>
          <div class="title">{{ v.title }}</div>
          <div class="desc" v-if="v.desc">{{ v.desc }}</div>
        </div>
        <div class="side">
          <button class="act" :class="{ on: liked[v.id] }" @click.stop="toggleLike(v)">
            ♥<span class="num">{{ fmt(statsOf(v).likes) }}</span>
          </button>
          <button class="act" @click.stop="openSheet(i)">
            💬<span class="num">{{ fmt(statsOf(v).comments) }}</span>
          </button>
          <button class="act" @click.stop>↗</button>
        </div>
      </section>
    </div>

    <div class="topbar">
      <span class="tab on">推荐</span>
      <span class="tab">关注</span>
    </div>
    <button class="mute" @click="muted = !muted">{{ muted ? '🔇' : '🔊' }}</button>
    <div class="empty" v-if="msg">{{ msg }}</div>

    <div class="backdrop" v-if="sheet > -1" @click="closeSheet"></div>
    <div class="sheet" :class="{ on: sheet > -1 }">
      <template v-if="sheet > -1 && list[sheet]">
        <header>
          <b>{{ fmt(statsOf(list[sheet]).comments) }} 条评论</b>
          <button @click="closeSheet">✕</button>
        </header>
        <div class="body">
          <div class="cmt" v-for="c in commentsOf(list[sheet])" :key="c.id">
            <div class="av" :style="{ background: c.color }">{{ c.name[0] }}</div>
            <div class="c">
              <div class="n">{{ c.name }}</div>
              <div class="t">{{ c.text }}</div>
              <div class="m">{{ c.ago }} · {{ fmt(c.likes + (cmtLiked[c.id] ? 1 : 0)) }} 赞</div>
              <div class="cmt" v-for="r in c.replies" :key="r.id" style="padding:6px 0">
                <div class="av" :style="{ background: '#444' }">{{ r.name[0] }}</div>
                <div class="c">
                  <div class="n">{{ r.name }}</div>
                  <div class="t">{{ r.text }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
  `
}).mount('#app')
