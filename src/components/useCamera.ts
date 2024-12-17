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
  const canvasElement = ref<HTMLCanvasElement>()
  const filterElement = ref<HTMLCanvasElement>()
  const ctx = computed(() => getContext(canvasElement.value))

  /**
   * Video
   */
  const size = ref<[number, number]>([0, 0])

  /**
   * Face detection and mood calculation
   */
  const detections =
    ref<
      faceapi.WithFaceExpressions<
        faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>
      >
    >()
  const mood = ref(180)

  onMounted(() => {
    loadModel()

    loadCamera()
  })

  const loadModel = async () => {
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    await faceapi.loadFaceLandmarkTinyModel(MODEL_URL)

    modelLoaded.value = true
  }

  const loadCamera = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => handleStream(stream))
  }

  const handleStream = (_stream: MediaStream) => {
    if (videoElement.value === undefined || canvasElement.value === undefined) return

    videoElement.value.requestVideoFrameCallback((now, metadata) => frameCallback(now, metadata))

    videoElement.value.srcObject = _stream
    videoElement.value.play()
  }

  const frameCallback = (now: number, metadata: VideoFrameCallbackMetadata) => {
    if (
      ctx.value === undefined ||
      videoElement.value === undefined ||
      canvasElement.value === undefined ||
      canvasElement.value === null
    )
      return

    size.value = [metadata.width, metadata.height]
    resizeCanvas(size.value)
    detectFaces()
    addLandmarks()
    updateMood()

    canvasElement.value.style.filter = `hue-rotate(${mood.value}deg)`

    videoElement.value.requestVideoFrameCallback((now, metadata) => frameCallback(now, metadata))
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
      .withFaceLandmarks(true)
      .withFaceExpressions()
  }

  const updateMood = () => {
    if (detections.value === undefined) return

    const expression = detections.value.expressions.asSortedArray()[0]

    if (expression === undefined) return

    switch (expression.expression) {
      case 'happy':
        mood.value = mood.value < 180 ? (mood.value += 10) : 180
        break
      case 'neutral':
        mood.value = mood.value > 0 ? (mood.value -= 5) : 0
        break
      case 'sad':
        mood.value = 0
        break
      case 'angry':
        mood.value = 0
        break
      default:
        console.log(expression.expression)
    }

    if (filterElement.value === undefined) return

    filterElement.value.style.background = `rgb(250 150 150 / ${mood.value / 180})`
  }

  const resizeCanvas = (size: [number, number]) => {
    if (canvasElement.value === undefined) return

    canvasElement.value.width = size[0]
    canvasElement.value.height = size[1]
  }

  const getContext = (_canvas: HTMLCanvasElement | undefined) => {
    if (_canvas === undefined || _canvas === null) return
    const ctx = _canvas.getContext('2d')
    if (ctx === null) return
    return ctx
  }

  return { videoElement, canvasElement, detections, filterElement }
}
