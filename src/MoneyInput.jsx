import React,{useLayoutEffect,useRef} from 'react';
export function formatMoney(value){
 if(value==null||value==='')return '';
 const [whole,fraction]=String(value).split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction!==undefined?','+fraction:'');
}
// The display uses Vietnamese separators; callers always receive an ungrouped numeric value.
export default function MoneyInput({value,onChange,min=0,step,decimals=2,...props}){
 const ref=useRef(null),caret=useRef(null);
 const display=formatMoney(value);
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;
  const fraction=String(value??'').split('.')[1]||'';
  el.setCustomValidity(value!==''&&value!=null&&(Number(value)<Number(min)||fraction.length>decimals)?'Anh nhập số tiền không âm, tối đa '+decimals+' chữ số sau dấu phẩy.':'');
  if(caret.current!=null&&document.activeElement===el){let remaining=caret.current,pos=0;while(pos<el.value.length&&remaining>0){if(el.value[pos]!=='.')remaining--;pos++;}el.setSelectionRange(pos,pos);caret.current=null;}
 },[display,value,min,decimals]);
 function change(e){const text=e.target.value;if(!/^[\d.,\s]*$/.test(text)||text.split(',').length>2){e.target.value=display;return;}
  caret.current=text.slice(0,e.target.selectionStart).replace(/[.\s]/g,'').length;
  let raw=text.replace(/[.\s]/g,'').replace(',','.');
  if(raw.startsWith('.'))raw='0'+raw;
  raw=raw.replace(/^0+(?=\d)/,'');
  onChange({...e,target:{...e.target,value:raw},currentTarget:{...e.target,value:raw}});
 }
 function keyDown(e){const el=e.currentTarget,pos=el.selectionStart;if(pos!==el.selectionEnd)return;
  // Removing a grouping dot also removes the adjacent digit, so Backspace never gets stuck.
  if(e.key==='Backspace'&&pos>1&&el.value[pos-1]==='.')el.setSelectionRange(pos-2,pos);
  if(e.key==='Delete'&&el.value[pos]==='.')el.setSelectionRange(pos,Math.min(pos+2,el.value.length));
 }
 return <input {...props} ref={ref} type="text" inputMode="decimal" autoComplete="off" data-money-input="true" value={display} onChange={change} onKeyDown={keyDown}/>;
}
