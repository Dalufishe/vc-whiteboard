import * as THREE from 'three'
import Loader from './Loader'
import ViewerCore from './core/ViewerCore'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min'

init()

async function init() {
  const volumeMeta = await Loader.getVolumeMeta()
  const segmentMeta = await Loader.getSegmentMeta()

  const viewer = new ViewerCore({ volumeMeta, segmentMeta })

  loading()
  update(viewer)
  labeling(viewer)
}

function update(viewer) {
  updateViewer(viewer)
  updateGUI(viewer)
}

function updateViewer(viewer) {
  const { mode } = viewer.params

  if (mode === 'segment') { modeA(viewer) }
  if (mode === 'volume') { modeB(viewer) }
  if (mode === 'volume-segment') { modeC(viewer) }
  if (mode === 'layer') { modeC(viewer) }
  if (mode === 'grid layer') { modeC(viewer) }
}

let gui

function updateGUI(viewer) {
  const { mode } = viewer.params

  if (gui) { gui.destroy() }
  gui = new GUI()
  gui.add(viewer.params, 'mode', ['segment', 'layer', 'grid layer', 'volume', 'volume-segment']).onChange(() => update(viewer))
  gui.add(viewer.params.layers, 'select', viewer.params.layers.options).name('layers').onChange(() => update(viewer))

  if (mode === 'segment') { return }
  if (mode === 'volume') { return }
  if (mode === 'volume-segment') {
    gui.add(viewer.params, 'surface', 0.001, 0.5).onChange(viewer.render)
  }
  if (mode === 'layer') {
    const id = viewer.params.layers.select
    const clip = viewer.volumeMeta.nrrd[id].clip

    viewer.params.layer = clip.z
    gui.add(viewer.params, 'inverse').onChange(viewer.render)
    gui.add(viewer.params, 'surface', 0.001, 0.5).onChange(viewer.render)
    gui.add(viewer.params, 'layer', clip.z, clip.z + clip.d, 1).onChange(viewer.render)
  }
  if (mode === 'grid layer') {
    gui.add(viewer.params, 'inverse').onChange(viewer.render)
    gui.add(viewer.params, 'surface', 0.001, 0.5).onChange(viewer.render)
  }
}

// segment mode
function modeA(viewer) {
  viewer.clear()
  const segment = viewer.updateSegment()

  const loadingDiv = document.querySelector('#loading')
  loadingDiv.style.display = 'inline'

  segment.then(() => viewer.render())
    .then(() => { console.log(`segment ${viewer.params.layers.select} is loaded`) })
    .then(() => { loadingDiv.style.display = 'none' })
}

// volume mode
function modeB(viewer) {
  viewer.clear()
  const volume = viewer.updateVolume()

  const loadingDiv = document.querySelector('#loading')
  loadingDiv.style.display = 'inline'

  volume.then(() => viewer.render())
    .then(() => { console.log(`volume ${viewer.params.layers.select} is loaded`) })
    .then(() => { loadingDiv.style.display = 'none' })
}

// volume-segment mode
function modeC(viewer) {
  viewer.clear()
  const volume = viewer.updateVolume()
  const segment = viewer.updateSegment()

  const loadingDiv = document.querySelector('#loading')
  loadingDiv.style.display = 'inline'

  Promise.all([volume, segment])
    .then(() => viewer.clipSegment())
    .then(() => viewer.updateSegmentSDF())
    .then(() => viewer.render())
    .then(() => { console.log(`volume-segment ${viewer.params.layers.select} is loaded`) })
    .then(() => { loadingDiv.style.display = 'none' })
}

// loading div element
function loading() {
  const loadingDiv = document.createElement('div')
  loadingDiv.id = 'loading'
  loadingDiv.innerHTML = 'Loading ...'
  document.body.appendChild(loadingDiv)
}

// segment labeling
function labeling(viewer) {
  const mouse = new THREE.Vector2()
  const labelDiv = document.createElement('div')
  labelDiv.id = 'label'
  document.body.appendChild(labelDiv)

  window.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof HTMLCanvasElement)) return
    mouse.x = e.clientX / window.innerWidth * 2 - 1
    mouse.y = - (e.clientY / window.innerHeight) * 2 + 1

    const { mode } = viewer.params
    labelDiv.style.display = 'none'

    if (mode === 'segment' || mode === 'layer') {
      // only this line is important
      const sTarget = viewer.getLabel(mouse)
      if (!sTarget) { return }

      const { id, clip } = sTarget
      labelDiv.style.display = 'inline'
      labelDiv.style.left = (e.clientX + 20) + 'px'
      labelDiv.style.top = (e.clientY + 20) + 'px'
      labelDiv.innerHTML = `${id}<br>layer: ${clip.z}~${clip.z+clip.d}`
      // as well as this line
      updateViewer(viewer)
    }
  })
}

