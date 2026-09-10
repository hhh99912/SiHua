<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Video, AlertTriangle, RefreshCw, Radio, Play, Pause, Volume2, VolumeX, ShieldCheck, Eye } from 'lucide-vue-next';
import { ScreenComponent } from '../../types';

interface Props {
  component: ScreenComponent;
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const videoRef = ref<HTMLVideoElement | null>(null);
const isVideoError = ref(false);
const isPlaying = ref(false);
const isMuted = ref(true);
const isHovering = ref(false);
const currentTimeStr = ref('');
let clockTimer: any = null;

const videoSrc = computed(() => {
  return props.component.customProps?.src || 
         props.component.style?.src || 
         props.component.data?.staticData?.src || 
         props.component.data?.staticData?.url || 
         '';
});

const posterUrl = computed(() => {
  return props.component.customProps?.poster || 
         props.component.style?.poster || 
         '';
});

const cameraTitle = computed(() => {
  return props.component.customProps?.cameraTitle || 
         props.component.name || 
         '工业视频监控';
});

const channelId = computed(() => {
  return props.component.customProps?.channelId || 'CAM-01';
});

const autoplay = computed(() => {
  return props.component.customProps?.autoplay !== false;
});

const loop = computed(() => {
  return props.component.customProps?.loop !== false;
});

const showControls = computed(() => {
  return Boolean(props.component.customProps?.showControls);
});

const showOverlay = computed(() => {
  return props.component.customProps?.showOverlay !== false;
});

const objectFit = computed(() => {
  return props.component.customProps?.objectFit || 'cover';
});

const isLinxOptimized = computed(() => {
  return props.component.customProps?.linxCompat !== false;
});

const borderRadius = computed(() => {
  return (props.component.style?.borderRadius ?? props.component.customProps?.borderRadius ?? 0) + 'px';
});

const opacity = computed(() => {
  return props.component.style?.opacity ?? props.component.customProps?.opacity ?? 1;
});

const stroke = computed(() => {
  return props.component.style?.stroke || props.component.customProps?.stroke || 'transparent';
});

const strokeWidth = computed(() => {
  return props.component.style?.strokeWidth ?? props.component.customProps?.strokeWidth ?? 0;
});

// Update live SCADA timestamp for HUD overlay
const updateClock = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  currentTimeStr.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  initVideoPlayback();
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
});

const initVideoPlayback = () => {
  if (!videoRef.value || !videoSrc.value) return;
  isVideoError.value = false;
  
  // Linx Linux & Chromium Autoplay Policy Compliance: Always ensure muted for zero-gesture autoplay
  videoRef.value.muted = isMuted.value;
  if (autoplay.value) {
    const playPromise = videoRef.value.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isPlaying.value = true;
      }).catch((err) => {
        console.warn('Autoplay prevented or video format requires user interaction:', err);
        isPlaying.value = false;
        // Fallback: force mute and retry once
        if (videoRef.value) {
          videoRef.value.muted = true;
          isMuted.value = true;
          videoRef.value.play().catch(() => {});
        }
      });
    }
  }
};

watch(() => videoSrc.value, () => {
  isVideoError.value = false;
  setTimeout(initVideoPlayback, 50);
});

const handleVideoError = () => {
  isVideoError.value = true;
  isPlaying.value = false;
};

const handleVideoPlay = () => {
  isPlaying.value = true;
  isVideoError.value = false;
};

const handleVideoPause = () => {
  isPlaying.value = false;
};

const togglePlayPause = () => {
  if (!videoRef.value) return;
  if (videoRef.value.paused) {
    videoRef.value.play().then(() => {
      isPlaying.value = true;
    }).catch(() => {});
  } else {
    videoRef.value.pause();
    isPlaying.value = false;
  }
};

const toggleMute = () => {
  if (!videoRef.value) return;
  isMuted.value = !isMuted.value;
  videoRef.value.muted = isMuted.value;
};

const handleRetry = () => {
  isVideoError.value = false;
  if (videoRef.value) {
    videoRef.value.load();
    initVideoPlayback();
  }
};
</script>

<template>
  <div 
    class="w-full h-full relative overflow-hidden select-none bg-[#030712] flex items-center justify-center group"
    :style="{
      borderRadius,
      opacity,
      border: strokeWidth > 0 && stroke !== 'transparent' ? `${strokeWidth}px solid ${stroke}` : 'none',
      contain: 'strict'
    }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Actual HTML5 / RTSP / HLS / MP4 Video Element (Hardware Layer Isolated) -->
    <video
      v-if="videoSrc && !isVideoError"
      ref="videoRef"
      :src="videoSrc"
      :poster="posterUrl || undefined"
      :autoplay="autoplay"
      :loop="loop"
      :muted="isMuted"
      :controls="showControls"
      playsinline
      webkit-playsinline
      disablePictureInPicture
      crossorigin="anonymous"
      @error="handleVideoError"
      @play="handleVideoPlay"
      @pause="handleVideoPause"
      class="w-full h-full object-cover pointer-events-auto"
      :style="{
        objectFit,
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }"
    />

    <!-- Empty Video Source State (Placeholder) -->
    <div 
      v-else-if="!videoSrc"
      class="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#071326] border-2 border-dashed border-cyan-500/40 rounded-lg text-cyan-300 pointer-events-none"
    >
      <div class="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-400/60 flex items-center justify-center mb-2 text-cyan-300 shadow-[0_0_12px_rgba(0,242,255,0.2)]">
        <Video class="w-5 h-5" />
      </div>
      <div class="text-xs font-mono font-medium text-cyan-200 mb-0.5 truncate max-w-full">
        {{ cameraTitle }} ({{ channelId }})
      </div>
      <p class="text-[10px] text-cyan-400 font-normal leading-tight">
        {{ previewMode ? '暂未配置视频监控流' : '右侧面板上传本地视频文件' }}
      </p>
      <div v-if="!previewMode" class="mt-2 px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono flex items-center gap-1">
        <ShieldCheck class="w-3 h-3 text-cyan-400" />
        <span>凝思Linux 硬件解码与无缝循环适配</span>
      </div>
    </div>

    <!-- Error State (Stream failed or disconnected) -->
    <div 
      v-else
      class="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#0d0714] border border-rose-500/50 rounded-lg text-rose-300"
    >
      <AlertTriangle class="w-7 h-7 text-rose-400 mb-1.5 animate-pulse" />
      <div class="text-xs font-mono font-medium text-rose-200 mb-0.5">视频流中断 / 解码异常</div>
      <p class="text-[10px] text-rose-300 font-mono truncate max-w-full px-2 mb-2">
        {{ videoSrc.substring(0, 36) }}...
      </p>
      <button
        type="button"
        @click.stop="handleRetry"
        class="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-[10px] font-mono text-rose-200 cursor-pointer transition-colors flex items-center gap-1 shadow-sm pointer-events-auto"
      >
        <RefreshCw class="w-3 h-3" />
        <span>重新连接视频流</span>
      </button>
    </div>

    <!-- Industrial SCADA HUD Camera Info Overlay (Top & Bottom Badges) -->
    <template v-if="showOverlay && videoSrc && !isVideoError">
      <!-- Top Left: Live Status & Camera Info -->
      <div class="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none z-20">
        <div class="px-2 py-0.5 rounded bg-[#0b1329] border border-cyan-500/60 flex items-center gap-1.5 shadow-md">
          <span class="w-2 h-2 rounded-full" :class="isPlaying ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-amber-400'"></span>
          <span class="text-[10px] font-mono font-bold" :class="isPlaying ? 'text-rose-300' : 'text-amber-300'">
            {{ isPlaying ? 'LIVE 实时' : 'PAUSED' }}
          </span>
          <span class="text-[10px] text-cyan-400 font-mono">|</span>
          <span class="text-[10px] text-slate-100 font-mono font-medium truncate max-w-[120px]">
            {{ cameraTitle }}
          </span>
        </div>
      </div>

      <!-- Top Right: Realtime Timestamp -->
      <div class="absolute top-2 right-2 pointer-events-none z-20">
        <div class="px-2 py-0.5 rounded bg-[#0b1329] border border-cyan-500/60 text-[10px] font-mono text-cyan-200 font-medium shadow-md">
          {{ currentTimeStr }}
        </div>
      </div>

      <!-- Bottom HUD Quick Control Bar (Visible on Hover in Preview/Canvas) -->
      <div 
        v-if="isHovering && !showControls"
        class="absolute bottom-2 inset-x-2 px-2.5 py-1 rounded bg-[#0b1329] border border-cyan-500/60 flex items-center justify-between z-20 transition-opacity duration-200 pointer-events-auto shadow-lg"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click.stop="togglePlayPause"
            class="p-1 rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-white transition-colors cursor-pointer"
            :title="isPlaying ? '暂停' : '播放'"
          >
            <Pause v-if="isPlaying" class="w-3.5 h-3.5" />
            <Play v-else class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click.stop="toggleMute"
            class="p-1 rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-white transition-colors cursor-pointer"
            :title="isMuted ? '取消静音' : '静音'"
          >
            <VolumeX v-if="isMuted" class="w-3.5 h-3.5 text-slate-400" />
            <Volume2 v-else class="w-3.5 h-3.5 text-cyan-300" />
          </button>
        </div>

        <div class="flex items-center gap-2 text-[10px] font-mono text-cyan-300">
          <span class="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-200 font-semibold">{{ channelId }}</span>
          <span class="text-slate-200">1080P 25FPS</span>
        </div>
      </div>
    </template>
  </div>
</template>
