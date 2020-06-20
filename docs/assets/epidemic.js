function renderEpidemic(svg, epidemicData, measuresData) {
  const numDays = epidemicData.data.length;
  const measures = measuresData.measures;

  const startDate = Date.parse(epidemicData.startDate);

  const maxValue = Math.max(...epidemicData.data);
  const measureColors = colorbrewer.Blues[Math.min(Math.max(measures.length, 3), 9)];

  const getMeasureColor = (index) => {
    return measureColors[(measures.length - 1 - i) % measureColors.length];
  };

  const width = 800;
  const height = 270;

  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("refX", 3)
    .attr("refY", 2)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0,0 V 4 L4,2 Z"); //this is actual shape for arrowhead

  var markers = [];
  for (var i = 0; i < measures.length; i++) {
    var marker = svg.append("defs").append("marker")
      .attr("id", "arrowhead" + i)
      .attr("refX", 0)
      .attr("refY", 1)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0,0 V 2 L2,1 Z") //this is actual shape for arrowhead
      .attr("fill", getMeasureColor(i));
    markers.push(marker);
  }

  var stackedBar = stackedBarchartGen(numDays, 2)(svg, width, height, false);

  var measureSeperationY = 14;

  let r = [];
  let lines = [];
  let linesDashed = [];

  var controlMeasureTimeline = svg.append("g");
  for (var i = 0; i < measures.length; i++) {
    var ri = controlMeasureTimeline.append("line")
      .attr("x1", stackedBar.X(-1) + "px")
      .attr("y1", (height + 20 + i * measureSeperationY) + "px")
      .attr("stroke", getMeasureColor(i))
      .attr("y2", (height + 20 + i * measureSeperationY) + "px")
      .attr("stroke-width", 4);
    r.push(ri);

    let linei = controlMeasureTimeline.append("line")
      .style("stroke", "black")
      .style("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)")
      .attr("opacity", 0.6);
    lines.push(linei);

    let lineDashed = controlMeasureTimeline.append("line")
      .style("stroke", "black")
      .style("stroke-width", 1.0)
      .style("stroke-dasharray", "4")
      .attr("opacity", 0.6);
    linesDashed.push(lineDashed);

    controlMeasureTimeline.append("text")
      .attr("class", "figtext2")
      .attr("x", 0)
      .attr("y", height + 18 + i * measureSeperationY)
      .attr("text-anchor", "end")
      .attr("fill", "gray")
      .html((i == 0) ? "Control Measure " + (measures.length - i) : (measures.length - i));
  }

  let trace = [];
  trace.length = numDays;

  for (var i = 0; i < numDays; i++) {
    trace[i] = [0, 0];
    trace[i][0] = epidemicData.data[i];
    trace[i][1] = 0.0; // without symptoms
  }

  let measureDays = [];
  let measureDaysEnd = [];
  measureDays.length = measures.length;
  measureDaysEnd.length = measures.length;

  for (var i = 0; i < measures.length; i++) {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const deltaT = (Date.parse(measures[i].startDate) - startDate);
    measureDays[i] = Math.floor(deltaT / (1000 * 60 * 60 * 24));

    const endDate = Date.parse(measures[i].endDate);
    if (endDate > 0) {
      const deltaTEnd = (endDate - startDate);
      measureDaysEnd[i] = Math.floor(deltaTEnd / (1000 * 60 * 60 * 24));
    } else {
      measureDaysEnd[i] = 0;
    }
  }

  stackedBar.update(trace, measureDays, new Date(startDate), maxValue);

  for (var i = 0; i < measures.length; i++) {
    const measureIndex = measures.length - 1 - i;
    const measure = measures[measureIndex];
    var endpoint = stackedBar.stack[0].selectAll("line").nodes()[measureDays[measureIndex]]
    var stack = endpoint.getBBox();
    var ctm = endpoint.getCTM();

    const startDateText = new Date(Date.parse(measure.startDate)).toLocaleDateString();
    const endDateText = (measureDaysEnd[measureIndex] != 0) ? (" - " + new Date(Date.parse(measure.endDate)).toLocaleDateString()) : "";
    const toolTip = startDateText + endDateText + ": " + measure.description;

    let showMarker = true;
    if (showMarker) {
      lines[i].attr("x2", stack.x)
        .attr("y2", height)
        .attr("x1", stack.x)
        .attr("y1", height + 22 + measureSeperationY * (i))
        .style("visibility", "visible")
        .append("title").html(toolTip);

      linesDashed[i].attr("x2", stack.x)
        .attr("y2", height)
        .attr("x1", stack.x)
        .attr("y1", -10)
        .style("visibility", "visible")
        .append("title").html(toolTip);
    }

    r[i].attr("x1", (stackedBar.X(measureDays[measureIndex]) + 0.75) + "px")
      .attr("x2", stackedBar.X((measureDaysEnd[measureIndex] != 0) ? measureDaysEnd[measureIndex] : numDays - 1) + "px")
      .attr("marker-end", "url(#arrowhead" + i + ")")
      .append("title").html(toolTip);

    setTM(controlMeasureTimeline.node(), ctm);
  }
}