export function getInterpretationFocus(lines, original, changed) {
  if (!Array.isArray(lines) || lines.length !== 6) {
    throw new TypeError("A reading must contain exactly six lines, from the first line upward.");
  }
  if (lines.some((line) => (
    !line
    || ![6, 7, 8, 9].includes(line.value)
    || line.changing !== (line.value === 6 || line.value === 9)
  ))) {
    throw new TypeError("Each line must be a consistent 6, 7, 8, or 9 casting result.");
  }
  const changing = lines
    .map((line, index) => (line?.changing ? index + 1 : null))
    .filter((position) => position !== null);
  const count = changing.length;

  if (count === 0) {
    return { rule: "靜卦", source: "本卦", positions: [], primary: null };
  }
  if (count === 1) {
    return { rule: "一爻變", source: "本卦", positions: changing, primary: changing[0] };
  }
  if (count === 2) {
    return { rule: "二爻變", source: "本卦", positions: changing, primary: changing[1] };
  }
  if (count === 3) {
    return { rule: "三爻變", source: "本卦與之卦", positions: [], primary: null };
  }
  if (count === 4 || count === 5) {
    const still = lines
      .map((line, index) => (!line?.changing ? index + 1 : null))
      .filter((position) => position !== null);
    return {
      rule: `${count} 爻變`,
      source: "之卦",
      positions: still,
      primary: still[0],
    };
  }
  if (original.name === "乾為天") {
    return { rule: "六爻皆變", source: "乾卦用九", positions: [], primary: null };
  }
  if (original.name === "坤為地") {
    return { rule: "六爻皆變", source: "坤卦用六", positions: [], primary: null };
  }
  return { rule: "六爻皆變", source: "之卦", positions: [], primary: null };
}

export function describeFocus(focus, original, changed) {
  const sourceName = focus.source === "之卦" ? changed.name : original.name;
  if (focus.source === "乾卦用九") return "乾卦全變，參照用九之義：群龍無首，吉。";
  if (focus.source === "坤卦用六") return "坤卦全變，參照用六之義：利永貞。";
  if (focus.rule === "靜卦") return `無變爻，以本卦「${original.name}」卦辭為觀照重心。`;
  if (focus.rule === "一爻變") return `以本卦「${original.name}」第 ${focus.primary} 爻爻辭為觀照重心。`;
  if (focus.rule === "二爻變") {
    return `參看本卦「${original.name}」第 ${focus.positions.join("、")} 爻，以較上位的第 ${focus.primary} 爻為主。`;
  }
  if (focus.rule === "三爻變") {
    return `綜合參照本卦「${original.name}」與之卦「${changed.name}」卦辭，首重本卦。`;
  }
  if (focus.rule === "4 爻變") {
    return `參看之卦「${changed.name}」未變的第 ${focus.positions.join("、")} 爻，以較下位者為主。`;
  }
  if (focus.rule === "5 爻變") {
    return `以之卦「${changed.name}」唯一未變的第 ${focus.primary} 爻爻辭為觀照重心。`;
  }
  return `六爻皆變，以之卦「${sourceName}」卦辭為觀照重心。`;
}
