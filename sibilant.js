const microevent = require('microevent')
const _ = require('lodash')

// get audio context
const AudioContextType = window.AudioContext || window.webkitAudioContext

// f_1 band for (most) human voice range
var LOW_FREQ_CUT = 85
var HIGH_FREQ_CUT = 583
var bandPassMiddleFrequency = ((HIGH_FREQ_CUT - LOW_FREQ_CUT) / 2) + LOW_FREQ_CUT
var bandPassFrequencyRange = HIGH_FREQ_CUT - bandPassMiddleFrequency

// bandpass filter from AudioContext
function bandPassFilterNode (audioContext) {
  var bandpass = audioContext.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = bandPassMiddleFrequency
  bandpass.Q = bandPassFrequencyRange
  return bandpass
}

function speakingDetectionNode (audioContext, analyser, threshold, emitter) {
  var javascriptNode = audioContext.createScriptProcessor(2048, 1, 1)
  var speakingTimes = []
  var quietHistory = [] // only contains continuous 'quiet' times
  var currentVolume = -Infinity

  var hasStoppedSpeaking = function () {
    return (_.max(quietHistory) - _.min(quietHistory) > 500)
  }

  javascriptNode.onaudioprocess = function () {
    var fftBins = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatFrequencyData(fftBins)
    var maxVolume = _.max(_.filter(fftBins, function (v) { return v < 0 }))
    currentVolume = maxVolume
    emitter.trigger('volumeChange', currentVolume)
    // speaking, add the date to the stack, clear quiet record
    if (currentVolume > threshold) {
      emitter.trigger('speaking')
      speakingTimes.push(new Date())
      quietHistory = []
    } else if (speakingTimes.length > 0) {
      if (hasStoppedSpeaking()) {
        emitter.trigger('stoppedSpeaking', {'start': _.min(speakingTimes), 'end': _.max(speakingTimes)})
        speakingTimes = []
      } else {
        quietHistory.push(new Date())
      }
    }
  }
  return javascriptNode
}

var Sibilant = function (element, options) {
  options = options || {}
  var self = this
  // var useBandPass = (options.useBandPass || true)
  var fftSize = (options.fftSize || 512)
  var threshold = (options.threshold || -40)
  var smoothing = (options.smoothing || 0.2)
  var passThrough = (options.passThrough || false)
  var audioContext = new AudioContextType()

  var analyser = audioContext.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = smoothing

  var audioSource = null
  // assume webRTC for now
  if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
    audioSource = audioContext.createMediaElementSource(element)
  } else {
    audioSource = audioContext.createMediaStreamSource(element)
  }
  var speakingNode = speakingDetectionNode(audioContext, analyser, threshold, self)
  var bandPassNode = bandPassFilterNode(audioContext)
  audioSource.connect(analyser)
  if (passThrough) {
    console.log('passing through', element)
    analyser.connect(audioContext.destination)
  }
  analyser.connect(bandPassNode)
  bandPassNode.connect(speakingNode)
  // needed for chrome onprocessaudio compatibility
  speakingNode.connect(audioContext.destination)
}

microevent.mixin(Sibilant)

module.exports = Sibilant
