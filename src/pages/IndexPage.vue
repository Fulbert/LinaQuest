<template>
  <q-page>
    <video ref="videoElement" style="display: none" />
    <canvas ref="canvasRawElement" style="display: none" />
    <canvas ref="canvasElement" class="fit" />
  </q-page>
</template>

<script setup lang="ts">
import { useCamera } from 'src/components/useCamera'

const { videoElement, canvasRawElement, canvasElement } = useCamera()
</script>
