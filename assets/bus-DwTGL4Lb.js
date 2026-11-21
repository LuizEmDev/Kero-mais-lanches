let f=null;const s=t=>{f=t},c=(t,o,a)=>f?.to(t).emit(o,a),e=(t,o={})=>f?.to("staff").emit("staff",{kind:t,...o});export{s as attachIO,c as toRoom,e as toStaff};
