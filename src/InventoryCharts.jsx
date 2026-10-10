import React,{useEffect,useState} from 'react';

const colors=['#087bd8','#27a9ee','#62d7ed','#437bb9','#6d97e2','#39afad','#a5bed3'];
const number=v=>Number(v).toLocaleString('vi-VN',{maximumFractionDigits:3});
const percent=v=>Number(v).toLocaleString('vi-VN',{maximumFractionDigits:1});
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):0;
function compact(data){
 const sorted=data.filter(d=>d.value>0).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label,'vi'));
 if(sorted.length<=7)return sorted;
 return [...sorted.slice(0,6),{key:'other',label:`Khác (${sorted.length-6} nhóm)`,value:sorted.slice(6).reduce((n,d)=>n+d.value,0)}];
}

export function InventoryPie({title,data,unit,controls,description}){
 const [active,setActive]=useState(null),[hover,setHover]=useState(null);
 const signature=JSON.stringify(data.map(d=>[d.key,d.value]));
 useEffect(()=>{setActive(null);setHover(null)},[signature]);
 const total=data.reduce((n,d)=>n+positive(d.value),0),picked=hover??active;
 const radius=80,circumference=2*Math.PI*radius;let offset=0;
 return <section className="inventory-chart" aria-label={title}>
  <div className="inventory-chart-heading"><h2>{title}</h2>{controls}</div>
  <div className="inventory-chart-body">
   <svg className="inventory-pie" viewBox="0 0 220 220" role="img" aria-label={`${title}: ${number(total)} ${unit}`}>
    <title>{title}. {data.map(d=>`${d.label}: ${number(d.value)} ${unit} (${total?percent(d.value/total*100):0}%)`).join('; ')}</title>
    <circle cx="110" cy="110" r={radius} fill="none" stroke="#e5eff7" strokeWidth="38"/>
    {data.map((d,i)=>{const length=total?positive(d.value)/total*circumference:0,start=offset;offset+=length;return length>0?<circle key={d.key} cx="110" cy="110" r={radius} fill="none" stroke={colors[i%colors.length]} strokeWidth={picked===i?42:38} strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 110 110)" opacity={picked==null||picked===i?1:.22} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><title>{d.label}: {number(d.value)} {unit} ({percent(d.value/total*100)}%)</title></circle>:null;})}
    <text x="110" y="108" textAnchor="middle" className="inventory-pie-total">{number(total)}</text>
    <text x="110" y="129" textAnchor="middle" className="inventory-pie-unit">{unit}</text>
   </svg>
   <div className="inventory-chart-legend">{total>0?data.map((d,i)=><button type="button" key={d.key} aria-pressed={active===i} onClick={()=>setActive(active===i?null:i)} className={picked===i?'is-active':''}>
    <i style={{background:colors[i%colors.length]}} aria-hidden="true"/><span><b>{d.label}</b><small>{number(d.value)} {unit} <em>({percent(d.value/total*100)}%)</em></small></span>
   </button>):<p className="inventory-chart-empty">Chưa có hàng tồn phù hợp để hiển thị biểu đồ.</p>}</div>
  </div>
  <p className="inventory-chart-note">{description}</p>
 </section>;
}

export function VehicleInventoryChart({vehicles,models=[],initialMode='type',reload,busy=false,filtered=false}){
 const [mode,setMode]=useState(initialMode);
 const names=new Map(models.map(m=>[m.ID,m.NAME]));const groups=new Map();
 for(const v of vehicles.filter(v=>v.STATUS==='AVAILABLE'&&!v.DELETED)){
  const type=v.VEHICLE_TYPE==='COMMERCIAL'?'Thương Mại':'Đăng Kiểm',model=v.MODEL||names.get(v.MODEL_ID)||'Chưa có mẫu xe',color=v.COLOR||'Chưa có màu';
  const key=mode==='type'?v.VEHICLE_TYPE:mode==='color'?color:mode==='model-color'?JSON.stringify([v.MODEL_ID,color]):String(v.MODEL_ID);
  const label=mode==='type'?type:mode==='color'?color:mode==='model-color'?`${model} · ${color}`:model;
  if(!groups.has(key))groups.set(key,{key,label,value:0});groups.get(key).value++;
 }
 const data=compact([...groups.values()]);
 return <InventoryPie title={mode==='type'?'Cơ cấu xe trong kho':mode==='color'?'Xe theo màu':mode==='model-color'?'Xe theo mẫu và màu':'Xe theo mẫu xe'} data={data} unit="xe" description={`${filtered?'Theo kết quả tìm kiếm. ':''}Chỉ tính xe còn trong kho. Bấm chú thích để xem tỷ trọng.${groups.size>7?' Các nhóm nhỏ được gộp vào Khác.':''}`} controls={<div className="inventory-chart-controls"><select aria-label="Cách chia biểu đồ xe" value={mode} onChange={e=>setMode(e.target.value)}><option value="type">Theo dòng xe</option><option value="model">Theo mẫu xe</option><option value="color">Theo màu</option><option value="model-color">Theo mẫu và màu</option></select>{reload&&<button className="ghost" type="button" disabled={busy} onClick={reload}>Làm mới</button>}</div>}/>;
}

export function MaterialInventoryChart({parts,filtered=false}){
 const [chosen,setChosen]=useState('');
 const units=[...new Set(parts.map(p=>String(p.UNIT||'Chưa có đơn vị').trim()))].sort((a,b)=>a.localeCompare(b,'vi'));
 const preferred=[...units].sort((a,b)=>parts.filter(p=>String(p.UNIT||'Chưa có đơn vị').trim()===b&&positive(p.QUANTITY)).length-parts.filter(p=>String(p.UNIT||'Chưa có đơn vị').trim()===a&&positive(p.QUANTITY)).length)[0]||'';
 const unit=units.includes(chosen)?chosen:preferred;
 const matching=parts.filter(p=>String(p.UNIT||'Chưa có đơn vị').trim()===unit);
 const data=compact(matching.map(p=>({key:String(p.ID),label:`${p.CODE} · ${p.NAME}`,value:positive(p.QUANTITY)})));
 return <InventoryPie title="Linh kiện còn trong kho" data={data} unit={unit||'đơn vị'} description={`${filtered?'Theo kết quả tìm kiếm. ':''}Xem riêng từng đơn vị tính, không cộng lẫn Cái, Bộ…${matching.filter(p=>positive(p.QUANTITY)).length>7?' Các mã có ít tồn được gộp vào Khác.':''}`} controls={<label className="inventory-unit"><span>Đơn vị</span><select aria-label="Đơn vị biểu đồ linh kiện" disabled={!units.length} value={unit} onChange={e=>setChosen(e.target.value)}>{units.length?units.map(u=><option key={u} value={u}>{u}</option>):<option value="">Chưa có dữ liệu</option>}</select></label>}/>;
}
