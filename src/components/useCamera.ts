import { computed, onMounted, ref } from 'vue'
import * as faceapi from 'face-api.js'

export const useCamera = () => {
  /**
   * Face recognition model loading
   */
  const MODEL_URL = './models' // path to public/models
  const modelLoaded = ref(false)

  /**
   * HTML elements (video, canvas)
   */
  const videoElement = ref<HTMLVideoElement>()
  const canvasRawElement = ref<HTMLCanvasElement>()
  const canvasElement = ref<HTMLCanvasElement>()
  const ctxRaw = computed(() => getContext(canvasRawElement.value))
  const ctx = computed(() => getContext(canvasElement.value))

  /**
   * Video
   */
  const size = ref<[number, number]>([0, 0])

  /**
   * Face detection and mood calculation
   */
  const detections = ref()
  const mood = ref(0)

  onMounted(() => {
    loadModel()

    loadCamera()
  })

  const loadModel = async () => {
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)

    modelLoaded.value = true
  }

  const loadCamera = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => handleStream(stream))
  }

  const handleStream = (_stream: MediaStream) => {
    if (
      videoElement.value === undefined ||
      canvasRawElement.value === undefined ||
      canvasElement.value === undefined
    )
      return

    videoElement.value.requestVideoFrameCallback((now, metadata) => frameCallback(now, metadata))

    videoElement.value.srcObject = _stream
    videoElement.value.play()
  }

  const frameCallback = (now: number, metadata: VideoFrameCallbackMetadata) => {
    if (
      ctxRaw.value === undefined ||
      videoElement.value === undefined ||
      canvasRawElement.value === undefined ||
      canvasRawElement.value === null
    )
      return

    size.value = [metadata.width, metadata.height]
    resizeCanvas(size.value)
    ctxRaw.value.drawImage(videoElement.value, 0, 0)

    handleImage()

    videoElement.value.requestVideoFrameCallback((now, metadata) => frameCallback(now, metadata))
  }

  const handleImage = async () => {
    if (ctx.value === undefined || ctxRaw.value === undefined || canvasElement.value === undefined)
      return

    detectFaces()
    addLandmarks()

    canvasElement.value.style.filter = `sepia(1) saturate(4) hue-rotate(${mood.value}deg)`
  }

  const previousLandmarkDrawn = ref(true)
  const addLandmarks = async () => {
    if (canvasElement.value === undefined) return

    if (!previousLandmarkDrawn.value) return

    const landmarks = await detections.value
    if (landmarks?.landmarks)
      faceapi.draw.drawFaceLandmarks(canvasElement.value, landmarks?.landmarks)

    previousLandmarkDrawn.value = true
  }

  const previousDetectionFinished = ref(true)
  const detectFaces = async () => {
    // Exit if models are not loaded yet
    if (!modelLoaded.value) return

    // Exit if videoElement is not defined
    if (videoElement.value === undefined || videoElement.value === null) return

    // Exit if videoElement is paused or finished
    if (videoElement.value.paused || videoElement.value.ended) return

    // Exit if previous detection is not finished
    if (!previousDetectionFinished.value) return

    detections.value = await faceapi
      .detectSingleFace(videoElement.value)
      .withFaceLandmarks()
      .withFaceExpressions()
  }

  const resizeCanvas = (size: [number, number]) => {
    if (canvasElement.value === undefined || canvasRawElement.value === undefined) return

    canvasElement.value.width = size[0]
    canvasElement.value.height = size[1]
    canvasRawElement.value.width = size[0]
    canvasRawElement.value.height = size[1]
  }

  const getContext = (_canvas: HTMLCanvasElement | undefined) => {
    if (_canvas === undefined || _canvas === null) return
    const ctx = _canvas.getContext('2d')
    if (ctx === null) return
    return ctx
  }

  return { videoElement, canvasRawElement, canvasElement, detections }
}
