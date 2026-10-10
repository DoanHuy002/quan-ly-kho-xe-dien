import React,{useRef,useEffect} from 'react';
export default function SelectionBox({checked,partial=false,onChange,label,disabled=false}){const ref=useRef();useEffect(()=>{if(ref.current)ref.current.indeterminate=partial},[partial]);return <input ref={ref} className="selection-box" type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>}
