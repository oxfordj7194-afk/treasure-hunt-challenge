import { getStore } from "@netlify/blobs";

const store = getStore({ name: "treasure-hunt-rooms", consistency: "strong" });
const json = (body, statusCode=200) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body)
});
const codeGen = () => Math.random().toString(36).slice(2,8).toUpperCase();
const points = [5,10,20,50];
const safeName = s => String(s || "Player").trim().slice(0,18) || "Player";
async function readRoom(code) { return await store.get(code, { type: "json" }); }
async function writeRoom(room) { await store.setJSON(room.code, room); }
function publicState(room) {
  const choicesCount = Object.values(room.choices || {}).filter(c=>c.locked).length;
  return {...room, choicesCount, choices: room.phase === "revealed" || room.finished ? room.choices : Object.fromEntries(Object.entries(room.choices||{}).map(([id,c])=>[id,{locked:c.locked}]))};
}
function winner(room) {
  const top = Math.max(...room.players.map(p=>p.score));
  const leaders = room.players.filter(p=>p.score===top);
  return leaders.length===1 ? leaders[0] : {name: "Tie game"};
}
function beginRound(room) { room.phase="choosing"; room.choices={}; room.log.unshift(`Round ${room.round} begins! Pick a hidden island location.`); }
export default async (req) => {
  if (req.method !== "POST") return json({error:"Use POST for game actions."},405);
  try {
    const body = JSON.parse(req.body || "{}");
    const {action, playerId} = body;
    const code = String(body.code || "").toUpperCase();
    let room;
    if (action === "create") {
      let newCode=codeGen();
      while(await readRoom(newCode)) newCode=codeGen();
      room={code:newCode,hostId:playerId,round:1,phase:"lobby",finished:false,players:[{id:playerId,name:safeName(body.name),score:0,shield:false,locked:false}],choices:{},log:["A new treasure hunt has begun. Share the room code with your friends."]};
      await writeRoom(room); return json({state:publicState(room)});
    }
    if (!code) return json({error:"Room code is required."},400);
    room=await readRoom(code);
    if(!room) return json({error:"Room not found. Check the code and try again."},404);
    if(action==="join"){
      if(!room.players.some(p=>p.id===playerId)){
        if(room.phase!=="lobby") return json({error:"This hunt has already started. Ask the host to make a new room."},400);
        if(room.players.length>=8) return json({error:"This room is full (8 players maximum)."},400);
        room.players.push({id:playerId,name:safeName(body.name),score:0,shield:false,locked:false});
        room.log.unshift(`${safeName(body.name)} joined the hunt.`);
        await writeRoom(room);
      }
      return json({state:publicState(room)});
    }
    if(action==="state") return json({state:publicState(room)});
    if(!room.players.some(p=>p.id===playerId)) return json({error:"You are not a player in this room."},403);
    if(action==="start"){
      if(room.hostId!==playerId) return json({error:"Only the host can start the round."},403);
      if(room.players.length<2) return json({error:"At least 2 players are needed to start."},400);
      if(room.phase!=="lobby") return json({error:"The hunt has already started."},400);
      beginRound(room); await writeRoom(room); return json({state:publicState(room)});
    }
    if(action==="choose"){
      if(room.phase!=="choosing") return json({error:"The round is not accepting choices."},400);
      if(!Number.isInteger(body.location)||body.location<0||body.location>5) return json({error:"Choose a location on the island."},400);
      if(room.choices[playerId]?.locked) return json({error:"Your choice is already locked."},400);
      room.choices[playerId]={location:body.location,locked:true};
      const player=room.players.find(p=>p.id===playerId); player.locked=true;
      await writeRoom(room); return json({state:publicState(room)});
    }
    if(action==="reveal"){
      if(room.hostId!==playerId) return json({error:"Only the host can reveal the choices."},403);
      if(room.phase!=="choosing") return json({error:"There is no round to reveal."},400);
      if(room.players.some(p=>!room.choices[p.id]?.locked)) return json({error:"Everyone must lock in a location before revealing."},400);
      room.phase="revealed";
      for(const p of room.players) {
        const location=room.choices[p.id].location;
        const roll=Math.random();
        if(roll<0.08) {
          const target=room.players.filter(x=>x.id!==p.id).sort((a,b)=>b.score-a.score)[0];
          if(target){
            if(target.shield){target.shield=false;room.log.unshift(`${p.name} found the 🔴 Thief Chest, but ${target.name}'s 🛡️ Lucky Shield blocked the theft!`);}
            else {const stolen=Math.min(25,Math.max(0,target.score));target.score-=stolen;p.score+=stolen;room.log.unshift(`${p.name} found the 🔴 Thief Chest and stole ${stolen} points from ${target.name}!`);}
          } else room.log.unshift(`${p.name} found a red Thief Chest, but there was nobody else to target.`);
        } else if(roll<0.18) {
          p.shield=true;room.log.unshift(`${p.name} found the 💜 Power Chest and gained a Lucky Shield!`);
        } else {
          const reward=points[Math.floor(Math.random()*points.length)];p.score+=reward;room.log.unshift(`${p.name} found ${reward} points at location ${location+1}!`);
        }
        p.locked=false;
      }
      if(room.round>=5){room.finished=true;room.phase="finished";room.winner=winner(room);room.log.unshift(`🏆 The hunt is over! ${room.winner.name} wins with ${Math.max(...room.players.map(p=>p.score))} points!`);}
      await writeRoom(room);return json({state:publicState(room)});
    }
    if(action==="next"){
      if(room.hostId!==playerId) return json({error:"Only the host can start the next round."},403);
      if(room.phase!=="revealed"||room.finished) return json({error:"The round is not ready to continue."},400);
      room.round++;beginRound(room);await writeRoom(room);return json({state:publicState(room)});
    }
    if(action==="reset"){
      if(room.hostId!==playerId) return json({error:"Only the host can reset the hunt."},403);
      room.round=1;room.finished=false;room.winner=null;room.phase="lobby";room.choices={};room.log=["A new hunt is ready. Share the room code with your friends."];
      for(const p of room.players){p.score=0;p.shield=false;p.locked=false;}
      await writeRoom(room);return json({state:publicState(room)});
    }
    return json({error:"Unknown game action."},400);
  } catch(e) { return json({error:e.message||"Unexpected game error."},500); }
};
