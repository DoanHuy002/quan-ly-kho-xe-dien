import React,{useState,useRef,useEffect,useId} from 'react';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export default function SearchablePartSelect({label,value,parts,onChange}){
 const [open,Open]=useState(false),[query,Query]=useState(''),[active,Active]=useState(0),box=useRef(null),input=useRef(null),id=useId();
 const selected=parts.find(p=>String(p.ID)===String(value));
 const title=p=>`${p.CODE} · ${p.NAME} (${p.UNIT})`;
 const options=parts.filter(p=>normalize(title(p)).includes(normalize(query)));
 useEffect(()=>{input.current?.setCustomValidity(selected?'':'Anh chọn một linh kiện trong danh sách.')},[selected]);
 useEffect(()=>{if(!open)return;const outside=e=>{if(!box.current?.contains(e.target))Open(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 useEffect(()=>{Active(0)},[query]);
 useEffect(()=>{box.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'})},[active,query,open]);
 function choose(p){onChange(String(p.ID));Open(false);Query('');input.current?.focus()}
 return <div className="part-search" ref={box} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))Open(false)}}>
  <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&options[active]?id+'-'+options[active].ID:undefined} required autoComplete="off" placeholder="Chọn / tìm mã hoặc tên linh kiện…" value={open?query:selected?title(selected):''} onClick={()=>{if(!open){Open(true);Query('')}}} onChange={e=>{Open(true);Query(e.target.value)}} onKeyDown={e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!open){Open(true);Query('');Active(0)}else Active(n=>Math.max(0,Math.min(options.length-1,n+(e.key==='ArrowDown'?1:-1))))}else if(e.key==='Enter'&&open){e.preventDefault();if(options[active])choose(options[active])}else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();Open(false)}}}/>
  {open&&<div className="part-search-popup"><small>Gõ mã hoặc tên linh kiện — tìm được cả chữ không dấu</small><div id={id} role="listbox" aria-label={'Danh sách '+label}>{options.length?options.map((p,i)=><button type="button" role="option" id={id+'-'+p.ID} key={p.ID} aria-selected={String(p.ID)===String(value)} data-active={i===active} onPointerDown={e=>e.preventDefault()} onMouseEnter={()=>Active(i)} onClick={()=>choose(p)}>{title(p)}</button>):<p role="status">Không tìm thấy linh kiện</p>}</div></div>}
 </div>
}
