const { createApp, ref, computed, onMounted, onBeforeUnmount, nextTick, watch } = Vue

function fmt(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  return String(n)
}

function ago(iso) {
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return '刚刚'
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前'
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前'
  if (d < 2592000) return Math.floor(d / 86400) + ' 天前'
  return new Date(iso).toLocaleDateString()
}

createApp({
  setup() {
    const list = ref([])
    const config = ref({})
    const paused = ref(-1)
    const liked = ref({})
    const muted = ref(true)
    const msg = ref('加载中…')
    const active = ref(null)
    const comments = ref({})
    const loading = ref(false)
    let observer = null

    const keyOf = (v) => v ? v.author + '/' + v.title : ''
    const allVideos = () => Array.from(document.querySelectorAll('.slide video'))

    const likesOf = (v) => {
      const base = (config.value.likes && config.value.likes[keyOf(v)]) || 0
      return base + (liked.value[v.id] ? 1 : 0)
    }

    const issueNum = (v) => config.value.issues && config.value.issues[keyOf(v)]

    const issueUrl = computed(() => {
      if (!active.value || !config.value.repo) return ''
      const n = issueNum(active.value)
      return n
        ? `https://github.com/${config.value.repo}/issues/${n}`
        : `https://github.com/${config.value.repo}/issues`
    })

    const currentComments = computed(() => comments.value[keyOf(active.value)] || [])

    const currentIndex = () => {
      let idx = 0
      allVideos().forEach((el, i) => {
        const r = el.getBoundingClientRect()
        if (Math.abs(r.top) < window.innerHeight / 2) idx = i
      })
      return idx
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

    const openComments = async (v) => {
      active.value = v
      const idx = list.value.indexOf(v)
      const el = allVideos()[idx]
      if (el) el.pause()

      const key = keyOf(v)
      if (comments.value[key]) return

      const num = issueNum(v)
      if (!num || !config.value.repo) {
        comments.value = { ...comments.value, [key]: [] }
        return
      }

      loading.value = true
      try {
        const res = await fetch(
          `https://api.github.com/repos/${config.value.repo}/issues/${num}/comments?per_page=100`,
          { headers: { Accept: 'application/vnd.github+json' } }
        )
        const data = await res.json()
        comments.value = {
          ...comments.value,
          [key]: Array.isArray(data) ? data.map((c) => ({
            id: c.id,
            user: c.user.login,
            avatar: c.user.avatar_url,
            body: c.body,
            ago: ago(c.created_at)
          })) : []
        }
      } catch {
        comments.value = { ...comments.value, [key]: [] }
      }
      loading.value = false
    }

    const closeComments = () => {
      active.value = null
      const el = allVideos()[currentIndex()]
      if (el) { el.muted = muted.value; el.play().catch(() => {}) }
    }

    watch(muted, (value) => allVideos().forEach((el) => { el.muted = value }))

    onMounted(async () => {
      try {
        const [vres, cres] = await Promise.all([
          fetch('videos.json', { cache: 'no-store' }),
          fetch('config.json', { cache: 'no-store' }).catch(() => null)
        ])
        if (!vres.ok) throw new Error('HTTP ' + vres.status)
        const vdata = await vres.json()
        list.value = Array.isArray(vdata) ? vdata : []
        if (cres && cres.ok) config.value = await cres.json()
        msg.value = list.value.length ? '' : (window.EMPTY_TIP || '暂无视频')
      } catch (err) {
        msg.value = '加载失败：' + err.message
      }

      await nextTick()

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.6 && !active.value) {
            playOnly(Number(entry.target.dataset.index))
          }
        })
      }, { threshold: [0, 0.6, 1] })
      document.querySelectorAll('.slide').forEach((el) => observer.observe(el))
    })

    onBeforeUnmount(() => { if (observer) observer.disconnect() })

    return { list, paused, liked, muted, msg, active, loading, currentComments,
      likesOf, issueUrl, fmt, toggle, toggleLike, openComments, closeComments }
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
            ♥<span class="num">{{ fmt(likesOf(v)) }}</span>
          </button>
          <button class="act" @click.stop="openComments(v)">💬</button>
        </div>
      </section>
    </div>

    <div class="topbar">
      <span class="tab on">推荐</span>
      <span class="tab">关注</span>
    </div>
    <button class="mute" @click="muted = !muted">{{ muted ? '🔇' : '🔊' }}</button>
    <div class="empty" v-if="msg">{{ msg }}</div>

    <div class="backdrop" v-if="active" @click="closeComments"></div>
    <div class="sheet" :class="{ on: active }">
      <header>
        <b v-if="active">{{ active.author }} · {{ active.title }}</b>
        <a v-if="issueUrl" :href="issueUrl" target="_blank" rel="noopener">发评论 ↗</a>
        <button @click="closeComments">✕</button>
      </header>
      <div class="body">
        <div v-if="loading" style="text-align:center;padding:24px;color:#888">加载中…</div>
        <div v-else-if="!currentComments.length" style="text-align:center;padding:32px;color:#888">
          还没有评论<br>
          <span style="font-size:12px">点右上角「发评论」去 GitHub 留言</span>
        </div>
        <div class="cmt" v-for="c in currentComments" :key="c.id">
          <img class="av" :src="c.avatar" referrerpolicy="no-referrer" alt="">
          <div class="c">
            <div class="n">{{ c.user }}</div>
            <div class="t">{{ c.body }}</div>
            <div class="m">{{ c.ago }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
}).mount('#app')
