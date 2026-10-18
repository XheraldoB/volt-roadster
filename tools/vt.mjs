import R from '@dimforge/rapier3d-compat';
await R.init();
const w = new R.World({x:0,y:-9.81,z:0});
w.createCollider(R.ColliderDesc.cuboid(500,0.5,500).setTranslation(0,-0.5,0));
const b = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,1,0));
w.createCollider(R.ColliderDesc.cuboid(0.95,0.35,2.2).setMass(1500),b);
const vc = w.createVehicleController(b);
console.log('up',vc.indexUpAxis,'fwd',vc.indexForwardAxis);
vc.setIndexForwardAxis=2;
const pts=[[0.85,-0.1,1.4],[-0.85,-0.1,1.4],[0.85,-0.1,-1.4],[-0.85,-0.1,-1.4]];
for(const p of pts){vc.addWheel({x:p[0],y:p[1],z:p[2]},{x:0,y:-1,z:0},{x:-1,y:0,z:0},0.35,0.36);}
for(let i=0;i<4;i++){vc.setWheelSuspensionStiffness(i,30);vc.setWheelFrictionSlip(i,2);vc.setWheelMaxSuspensionForce(i,1e5);}
for(let s=0;s<240;s++){for(let i=0;i<4;i++)vc.setWheelEngineForce(i,2000); if(s>120){vc.setWheelSteering(0,0.3);vc.setWheelSteering(1,0.3);} vc.updateVehicle(1/60); w.step();}
const t=b.translation(); console.log(t, vc.currentVehicleSpeed(), b.linvel());
