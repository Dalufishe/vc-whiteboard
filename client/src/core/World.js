import * as THREE from "three";

import WhiteBoard from "./WhiteBoard";
import CardSet from "./CardSet";
// import GUIPanel from './GUIPanel'
import Controls from "./Controls";
import Application from "./Application";
import { HintShader } from './core/HintShader';

import PubSub from "pubsub-js";
// import { TIFFLoader } from 'three/addons/loaders/TIFFLoader.js';
// import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

export default class World {
  constructor(_option) {
    this.app = _option.app;
    this.time = _option.time;
    this.sizes = _option.sizes;
    this.camera = _option.camera;
    this.renderer = _option.renderer;

    this.container = new THREE.Object3D();
    this.container.matrixAutoUpdate = false;

    this.start();
  }

  start() {
    this.setControls();
    this.setWhiteBoard();
    this.setCard();

    // PubSub.subscribe("onFileSelect", async(eventName, fileObj) => {
    //   console.log(eventName, fileObj)

    //   const blobUrl = URL.createObjectURL(fileObj.blob)

    //   // const texture = await new THREE.TextureLoader().loadAsync('Stitching_Megas.png')
    //   const obj = await new OBJLoader().loadAsync(blobUrl)
    //   // const texture = new THREE.TextureLoader().load(blobUrl)
    //   console.log(obj)

    //   // const material = new HintShader()
    //   // material.uniforms.tDiffuse.value = texture

    //   const mesh = new THREE.Mesh(obj.children[0].geometry, new THREE.MeshBasicMaterial())
    //   // const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    //   mesh.position.set(0, 0, 0.5)
    //   this.container.add(mesh)
    // })
  }

  setControls() {
    this.controls = new Controls({
      time: this.time,
      sizes: this.sizes,
      camera: this.camera,
    });
  }

  setWhiteBoard() {
    this.whiteBoard = new WhiteBoard({});
    this.container.add(this.whiteBoard.container);

    this.time.trigger("tick");
  }

  setCard() {
    this.cardSet = new CardSet({
      app: this.app,
      time: this.time,
      sizes: this.sizes,
      camera: this.camera,
      renderer: this.renderer,
    });

    this.time.on('tick', () => {
      const cameraInfo = {}
      cameraInfo.x = this.camera.instance.position.x.toFixed(5)
      cameraInfo.y = this.camera.instance.position.y.toFixed(5)
      cameraInfo.z = this.camera.instance.position.z.toFixed(5)

      const cardSetInfo = []
      this.cardSet.list.forEach((card) => {
        const cardInfo = {}

        const position = {}
        position.x = parseFloat(card.userData.center.x.toFixed(5))
        position.y = parseFloat(card.userData.center.y.toFixed(5))
        position.z = parseFloat(card.userData.center.z.toFixed(5))

        const { w, h } = card.userData;
        const center = card.position.clone()
        const info = this.getScreenPosition(center, w, h)

        const positionScreen = {}
        positionScreen.x = parseInt(info.x)
        positionScreen.y = parseInt(info.y)

        cardInfo.id = card.userData.id
        cardInfo.name = card.userData.name
        cardInfo.type = card.userData.type
        cardInfo.position = position
        cardInfo.positionScreen = positionScreen
        cardInfo.width = parseFloat(card.userData.w.toFixed(5))
        cardInfo.height = parseFloat(card.userData.h.toFixed(5))
        cardInfo.widthScreen = parseInt(info.width)
        cardInfo.heightScreen = parseInt(info.height)

        cardSetInfo.push(cardInfo)
      })

      const config = {}
      config.camera = cameraInfo
      config.cards = cardSetInfo

      PubSub.publish("onWhiteboardUpdate", config)
    })

    PubSub.subscribe("onUrlCardGenerated", (eventName, { id, x, y, width, height }) => {
      const scenePos = this.getScenePosition(x, y, width, height)
      const card = this.cardSet.createIframe(id, scenePos.center, scenePos.width, scenePos.height)
      card.visible = false
      this.container.add(card)
      this.time.trigger("tick")
    })

    // generate a card when clicking
    this.time.on("mouseDown", () => {
      let name;
      if (this.controls.numKeyPress[0]) name = "20230522181603";
      if (this.controls.numKeyPress[1]) name = "20230509182749";
      if (this.controls.numKeyPress[2]) name = "20230702185752";
      if (this.controls.numKeyPress[3]) name = " ";
      if (!name) return;

      const intersects = this.controls.getRayCast([this.whiteBoard.container]);
      if (!intersects.length) return;

      const pos = intersects[0].point;
      const center = new THREE.Vector3(pos.x, pos.y, 0);
      const dom = this.setDOM();
      const card = this.cardSet.create(name, dom, this.controls.mouse, center);
      this.container.add(card);

      this.time.trigger("tick");

      // this api is the bridge from Whiteboard Engine to React App.
      const id = card.uuid;
      const { w, h } = card.userData;
      const c = card.position.clone();
      const { x, y, width, height } = this.getScreenPosition(c, w, h);
      this.app.API.cardGenerate({ id, name, x, y, width, height });
      this.app.API.cardInit({ id, name, x, y, width, height });
    });

    // mouse pointer
    this.time.on('mouseMove', () => {
      document.body.style.cursor = 'auto';

      const intersects = this.controls.getRayCast(this.cardSet.list);
      if (!intersects.length) return;
      document.body.style.cursor = 'pointer';
    });

    // drag the card
    this.cardDonwPos = null
    this.mouseDownPos = null
    this.mouseNowPos = null

    this.time.on('mouseDown', () => {
      const intersects = this.controls.getRayCast(this.cardSet.list);
      if (!intersects.length) return;

      const card = intersects[0].object;
      this.cardSet.targetCard = card;
      this.mouseDownPos = intersects[0].point;
      this.cardDownPos = card.position.clone();
      this.camera.controls.enabled = false;
    });
    this.time.on('mouseMove', () => {
      if (!this.controls.mousePress) { this.cardDonwPos = null; this.mouseDownPos = null; this.mouseNowPos = null; return; }
      if (!this.mouseDownPos || !this.cardSet.targetCard || this.controls.spacePress) { return; }

      const intersects = this.controls.getRayCast([this.whiteBoard.container]);
      if (!intersects.length) return;

      this.mouseNowPos = intersects[0].point;
      const pos = this.cardDownPos.clone().add(this.mouseNowPos).sub(this.mouseDownPos);
      this.cardSet.targetCard.position.copy(pos);
      this.cardSet.targetCard.userData.center = pos;

      const { dom } = this.cardSet.targetCard.userData;
      if (!dom) return

      const [pbl, ptr] = this.cardSet.updateCanvas(this.cardSet.targetCard);
      const { width, height } = this.sizes.viewport;

      dom.style.left = `${(pbl.x + 1) * width * 0.5}px`;
      dom.style.bottom = `${(pbl.y + 1) * height * 0.5}px`;
      dom.style.width = `${(ptr.x - pbl.x) * width * 0.5}px`;
      dom.style.height = `${(ptr.y - pbl.y) * height * 0.5}px`;
      dom.style.display = "none";

      const { w, h } = this.cardSet.targetCard.userData;
      const center = this.cardSet.targetCard.position.clone();
      const info = this.getScreenPosition(center, w, h);
      info.id = this.cardSet.targetCard.uuid;
      this.app.API.cardMove(info);

      this.time.trigger("tick");
    });
    this.time.on('mouseUp', () => {
      this.camera.controls.enabled = true;
      if (!this.cardSet.targetCard) return;

      const { dom } = this.cardSet.targetCard.userData;
      if (!dom) return;

      dom.style.display = "none";
      this.cardSet.targetCard = null;
    });

    // make the whiteboard controllable (all scene in cards remains unchanged)
    this.time.on("spaceUp", () => {
      if (!this.cardSet.targetCard) return
      this.app.API.cardLeave(!this.cardSet.targetCard.uuid)

      document.body.style.cursor = "auto";
      this.camera.controls.enabled = true;
      this.cardSet.targetCard = null;

      this.cardSet.list.forEach((card) => {
        const { dom } = card.userData;
        if (!dom) return
        dom.style.display = "none";
      });
    });

    // fix the whiteboard (scene in selected card is controllable)
    this.time.on("spaceDown", () => {
      this.camera.controls.enabled = false;
      const intersects = this.controls.getRayCast(this.cardSet.list);

      if (!intersects.length && this.cardSet.targetCard) { this.app.API.cardLeave(this.cardSet.targetCard.uuid); }
      if (intersects.length && this.cardSet.targetCard && this.cardSet.targetCard.uuid !== intersects[0].object.uuid) { this.app.API.cardLeave(this.cardSet.targetCard.uuid); }
      if (!intersects.length) { this.cardSet.targetCard = null; return; }

      const card = intersects[0].object;
      const { dom, viewer, w, h } = card.userData;

      if (!this.cardSet.targetCard || (this.cardSet.targetCard && this.cardSet.targetCard.uuid !== card.uuid)) {
        const u = card.userData;
        const center = card.position.clone();
        const info = this.getScreenPosition(center, u.w, u.h);
        info.id = card.uuid;
        this.app.API.cardSelect(info);
      }
      this.cardSet.targetCard = card;

      this.cardSet.list.forEach((c) => {
        const v = c.userData.viewer;
        if (v) v.controls.enabled = false;
      });
      if (viewer) viewer.controls.enabled = true;

      const [pbl, ptr] = this.cardSet.updateCanvas(card);
      const { width, height } = this.sizes.viewport;

      if (!dom) return
      dom.style.left = `${(pbl.x + 1) * width * 0.5}px`;
      dom.style.bottom = `${(pbl.y + 1) * height * 0.5}px`;
      dom.style.width = `${(ptr.x - pbl.x) * width * 0.5}px`;
      dom.style.height = `${(ptr.y - pbl.y) * height * 0.5}px`;
      dom.style.display = "inline";
    });
  }

  getScreenPosition(center, w, h) {
    const corner = new THREE.Vector3(center.x + w / 2, center.y + h / 2, center.z);
    center.project(this.camera.instance);
    corner.project(this.camera.instance);

    const x = this.sizes.width * (1 + center.x) / 2;
    const y = this.sizes.height * (1 - center.y) / 2;
    const wScreen = this.sizes.width * Math.abs(corner.x - center.x);
    const hScreen = this.sizes.height * Math.abs(corner.y - center.y);

    return { x, y, width: wScreen, height: hScreen }
  }

  getScenePosition(x, y, w, h) {
    const mc = new THREE.Vector2()
    mc.x = x / this.sizes.width * 2 - 1
    mc.y = -(y / this.sizes.height) * 2 + 1

    const me = new THREE.Vector2()
    me.x = (x + w / 2) / this.sizes.width * 2 - 1
    me.y = -((y + h / 2) / this.sizes.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mc, this.camera.instance)
    const intersectsC = raycaster.intersectObjects([ this.whiteBoard.container ])
    raycaster.setFromCamera(me, this.camera.instance)
    const intersectsE = raycaster.intersectObjects([ this.whiteBoard.container ])
    if (!intersectsC.length || !intersectsE.length) return

    const center = intersectsC[0].point
    const corner = intersectsE[0].point
    const wScene = 2 * Math.abs(corner.x - center.x)
    const hScene = 2 * Math.abs(corner.y - center.y)

    return { center, width: wScene, height: hScene }
  }

  setDOM() {
    const cardDOM = document.createElement("div");

    cardDOM.className = "cardDOM";
    cardDOM.style.backgroundColor = "rgba(0, 0, 0, 0.0)";
    // cardDOM.style.border = "1px solid white";
    cardDOM.style.display = "none";
    cardDOM.style.position = "absolute";
    document.body.appendChild(cardDOM);

    return cardDOM;
  }
}
