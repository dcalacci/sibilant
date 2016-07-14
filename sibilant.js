const microevent = require('microevent')
const _ = require('lodash')

// get audio context
const AudioContextType = window.webkitAudioContext || window.AudioContext

// f_1 band for human voice range
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

function speakingDetectionNode (audioContext, analyser, threshold, speakingCallback) {
  var javascriptNode = audioContext.createScriptProcessor(2048, 1, 1)
  var speakingTimes = []
  var quietHistory = [] // only contains continuous 'quiet' times
  var currentVolume = -Infinity

  var hasStoppedSpeaking = function () {
    return (_.max(quietHistory) - _.min(quietHistory) > 1000)
  }

  var sendSpeakingEvent = function () {
    speakingCallback(
      {
        start: _.min(speakingTimes),
        end: _.max(speakingTimes)
      }
    )
  }

  javascriptNode.onaudioprocess = function () {
    var fftBins = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatFrequencyData(fftBins)
    var maxVolume = _.max(_.filter(fftBins, function (v) { return v < 0 }))
    currentVolume = maxVolume
    // speaking, add the date to the stack, clear quiet record
    if (currentVolume > threshold) {
      speakingTimes.push(new Date())
      quietHistory = []
    } else if (speakingTimes.length > 0) {
      if (hasStoppedSpeaking()) {
        sendSpeakingEvent()
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
  // var useBandPass = (options.useBandPass || true)
  var fftSize = (options.fftSize || 512)
  var threshold = (options.threshold || -35)
  var smoothing = (options.smoothing || 0.2)
  var self = this
  var audioContext = new AudioContextType()

  var analyser = audioContext.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = smoothing

  console.log('element:', element)
  // assume webRTC for now
  var audioSource = audioContext.createMediaStreamSource(element)
  var speakingNode = speakingDetectionNode(audioContext, analyser, threshold, function (obj) {
    self.trigger('spoke', obj)
  })
  var bandPassNode = bandPassFilterNode(audioContext)
  audioSource.connect(analyser)
  analyser.connect(bandPassNode)
  bandPassNode.connect(speakingNode)
  analyser.connect(audioContext.destination)
  /* analyser.connect(bandPassFilterNode)
   * bandPassNode.connect(speakingNode)
   * analyser.connect(audioContext.destination)*/
}

microevent.mixin(Sibilant)

module.exports = Sibilant
