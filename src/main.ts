import Phaser from "phaser";

class Hello extends Phaser.Scene {
  create() {
    this.add.text(20, 20, "Overlap", { color: "#e8ecff", fontSize: "32px" });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.getElementById("app")!,
  backgroundColor: "#0b1020",
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [Hello],
});
