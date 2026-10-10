// Apply the same numeric ID order to lists and nested detail lists.
export function orderRows(value){
 if(Array.isArray(value)){
  const rows=value.map(orderRows);
  const key=rows.length&&rows.every(r=>r&&typeof r==='object'&&Number.isFinite(Number(r.ID??r.ROW_ID)))?(rows.every(r=>r.ID!=null)?'ID':'ROW_ID'):null;
  return key?rows.sort((a,b)=>Number(a[key])-Number(b[key])):rows;
 }
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,orderRows(v)]));
 return value;
}
