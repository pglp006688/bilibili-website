const { createApp, ref, onMounted, onBeforeUnmount, nextTick, watch } = Vue

createApp({
  setup() {
    const list = ref([])
    const paused = ref(-1)
    const liked = ref({})
    const muted = ref(true)
    const msg = ref('加载中…')
    let observer = null

    const allVideos = () => Array.from(document.querySelectorAll('.slide video'))

    const playOnly = (index) => {
      allVideos().forEach((el, i) => {
        if (i === index) {
          el.muted = muted.value
          el.play().catch(() => {})
        } else {
          el.pause()
        }
      })
      paused.value = -1
    }

    const toggle = (index) => {
      const el = allVideos()[index]
      if (!el) return
      if (el.paused) {
        el.play().catch(() => {})
        paused.value = -1
      } else {
        el.pause()
        paused.value = index
      }
    }

    const toggleLike = (item) => {
      liked.value = { ...liked.value, [item.id]: !liked.value[item.id] }
    }

    watch(muted, (value) => allVideos().forEach((el) => { el.muted = value }))

    onMounted(async () => {
      try {
        const res = await fetch('videos.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        list.value = Array.isArray(data) ? data : []
        msg.value = list.value.length ? '' : '暂无视频，把文件放进 videos/ 后重新部署'
      } catch (err) {
        msg.value = '加载失败：' + err.message
      }

      await nextTick()

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.intersectionRatio >= 0.6) {
              playOnly(Number(entry.target.dataset.index))
            }
          })
        },
        { threshold: [0, 0.6, 1] }
      )
      document.querySelectorAll('.slide').forEach((el) => observer.observe(el))
    })

    onBeforeUnmount(() => { if (observer) observer.disconnect() })

    return { list, paused, liked, muted, msg, toggle, toggleLike }
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
          <button class="act" :class="{ on: liked[v.id] }" @click.stop="toggleLike(v)">♥</button>
          <button class="act" @click.stop>💬</button>
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
  </div>
  `
}).mount('#app')
