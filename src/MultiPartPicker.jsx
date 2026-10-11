import React,{useState,useMemo,useRef,useEffect} from 'react';
import SelectionBox from './SelectionBox.jsx';
import {materialGroups} from './GroupedTables.jsx';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const fmt=n=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3}).format(n);
export default function MultiPartPicker({parts,stock=[],models=[],existing=[],onAdd,onClose,outbound=false}){
 const [query,Q]=useState(''),[group,G]=useState(''),[model,M]=useState(''),[picked,P]=useState([]),box=useRef(null),search=useRef(null);
 useEffect(()=>{const previous=document.activeElement;search.current?.focus();return()=>previous?.isConnected&&previous.focus();},[]);
 const quantities=useMemo(()=>new Map(stock.map(x=>[Number(x.ID),Number(x.QUANTITY)||0])),[stock]);
 const blocked=new Set(existing.filter(l=>{const p=parts.find(p=>String(p.ID)===String(l.part_id));return p&&(!p.COLOR_MODELS?.length||p.COLOR_PARENT_ID);}).map(l=>String(l.part_id)));
 const rows=parts.filter(p=>{
  if(group&&(p.MATERIAL_GROUP||'UNASSIGNED')!==group)return false;
  if(!norm([p.CODE,p.NAME,p.COLOR,p.UNIT].join(' ')).includes(norm(query)))return false;
  if(!model)return true;
  if(p.COLOR_MODEL_ID)return Number(p.COLOR_MODEL_ID)===Number(model);
  const associated=[...(p.COLOR_MODELS||[]),...(p.BOM_MODELS||[])].map(Number);
  return associated.length===0||associated.includes(Number(model));
 });
 const selectable=rows.filter(p=>!blocked.has(String(p.ID)));
 const chosen=parts.filter(p=>picked.includes(String(p.ID))),shownPicked=selectable.filter(p=>picked.includes(String(p.ID)));
 function select(id,yes){if(blocked.has(String(id)))return;P(v=>yes?[...new Set([...v,String(id)])]:v.filter(x=>x!==String(id)));}
 function quantity(p){let n=quantities.get(Number(p.ID))||0;if(!p.COLOR_PARENT_ID&&p.COLOR_MODELS?.length)n+=parts.filter(c=>Number(c.COLOR_PARENT_ID)===Number(p.ID)).reduce((sum,c)=>sum+(quantities.get(Number(c.ID))||0),0);return n;}
 function keyboard(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}if(e.key==='Tab'){const els=[...box.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
 return <div className="overlay multi-part-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}} onKeyDown={keyboard}><section ref={box} className="modal multi-part-picker" role="dialog" aria-modal="true" aria-label="Chọn nhiều linh kiện"><div className="section-title"><h2>Chọn nhiều linh kiện</h2><button type="button" className="ghost" aria-label="Đóng chọn linh kiện" onClick={onClose}>×</button></div><p>Tích các linh kiện cần dùng rồi thêm vào phiếu một lần.</p>
 <div className="multi-part-filters"><input ref={search} aria-label="Tìm nhiều linh kiện" placeholder="Tìm theo mã hoặc tên linh kiện…" value={query} onChange={e=>Q(e.target.value)}/><select aria-label="Lọc mẫu xe linh kiện" value={model} onChange={e=>M(e.target.value)}><option value="">Mẫu xe: Tất cả</option>{models.map(m=><option key={m.ID} value={m.ID}>{m.NAME}</option>)}</select></div>
 <div className="multi-part-tabs" role="group" aria-label="Nhóm linh kiện">{[['','Tất cả'],...materialGroups,['UNASSIGNED','Chưa phân nhóm']].map(([id,label])=><button type="button" key={id} className={group===id?'':'ghost'} aria-pressed={group===id} onClick={()=>G(id)}>{label}</button>)}</div>
 <div className="multi-part-status"><label><SelectionBox label="Chọn tất cả kết quả đang hiển thị" checked={selectable.length>0&&shownPicked.length===selectable.length} partial={shownPicked.length>0&&shownPicked.length<selectable.length} disabled={!selectable.length} onChange={yes=>P(v=>yes?[...new Set([...v,...selectable.map(p=>String(p.ID))])]:v.filter(id=>!selectable.some(p=>String(p.ID)===id)))}/> Chọn tất cả kết quả đang hiển thị</label><strong>Đã chọn: {chosen.length} linh kiện</strong><button type="button" className="ghost" disabled={!chosen.length} onClick={()=>P([])}>Bỏ chọn tất cả</button></div>
 <div className="table-wrap multi-part-table"><table><thead><tr><th>Chọn</th><th>Mã</th><th>Tên linh kiện / Màu</th><th>Nhóm</th><th>Đơn vị</th><th>Tồn hiện tại</th></tr></thead><tbody>{rows.map(p=><tr key={p.ID} className={picked.includes(String(p.ID))?'picked':''}><td><SelectionBox label={'Chọn linh kiện '+p.CODE} checked={picked.includes(String(p.ID))} disabled={blocked.has(String(p.ID))} onChange={yes=>select(p.ID,yes)}/></td><td>{p.CODE}</td><td><label><input className="sr-only" type="checkbox" checked={picked.includes(String(p.ID))} disabled={blocked.has(String(p.ID))} onChange={e=>select(p.ID,e.target.checked)} tabIndex={-1}/>{p.NAME}{blocked.has(String(p.ID))&&<small>Đã có trong phiếu</small>}{p.COLOR&&<small>{p.COLOR}</small>}</label></td><td>{materialGroups.find(([id])=>id===p.MATERIAL_GROUP)?.[1]||'Chưa phân nhóm'}</td><td>{p.UNIT}</td><td className={outbound&&quantity(p)<=0?'low-stock':''}>{fmt(quantity(p))}{!p.COLOR_PARENT_ID&&p.COLOR_MODELS?.length>0&&<small>Tổng tồn các màu; chọn màu trên phiếu</small>}</td></tr>)}</tbody></table>{!rows.length&&<p role="status">Không tìm thấy linh kiện phù hợp.</p>}</div>
 <div className="multi-part-chosen">{chosen.length?chosen.map(p=><button type="button" className="ghost" key={p.ID} aria-label={'Bỏ chọn '+p.CODE} onClick={()=>select(p.ID,false)}>{p.CODE} · {p.NAME} ×</button>):'Chưa chọn linh kiện nào.'}</div><p className="hint">Đổi nhóm hoặc tìm kiếm vẫn giữ các linh kiện đã chọn. Mỗi linh kiện thêm một dòng, số lượng mặc định 1; anh chỉnh số lượng, mẫu xe / màu và giá trên phiếu.{outbound&&' Tồn chỉ để tham khảo; app kiểm tra lại và chặn xuất vượt tồn khi ghi sổ.'}</p>
 <div className="modal-footer"><button type="button" className="ghost" onClick={onClose}>Hủy</button><button type="button" disabled={!chosen.length} onClick={()=>onAdd(chosen)}>Thêm {chosen.length} linh kiện</button></div></section></div>;
}
