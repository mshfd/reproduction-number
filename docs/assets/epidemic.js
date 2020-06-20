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

  var r = [];
  var lines = [];

  var progressmeter = svg.append("g");
  for (var i = 0; i < measures.length; i++) {
    var ri = progressmeter.append("line")
      .attr("x1", stackedBar.X(-1) + "px")
      .attr("y1", (height + 20 + i * measureSeperationY) + "px")
      .attr("stroke", getMeasureColor(i))
      .attr("y2", (height + 20 + i * measureSeperationY) + "px")
      .attr("stroke-width", 4);
    r.push(ri);

    var linei = progressmeter.append("line")
      .style("stroke", "black")
      .style("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)")
      .attr("opacity", 0.6);
    lines.push(linei);

    progressmeter.append("text")
      .attr("class", "figtext2")
      .attr("x", 0)
      .attr("y", height + 18 + i * measureSeperationY)
      .attr("text-anchor", "end")
      .attr("fill", "gray")
      .html((i == 0) ? "Measure " + (measures.length - i) : (measures.length - i));
  }

  let trace = [];
  trace.length = numDays;

  for (var i = 0; i < numDays; i++) {
    trace[i] = [0, 0];
    trace[i][0] = epidemicData.data[i] / maxValue;
    trace[i][1] = 0.0; // without symptoms
  }

  // Update the milestones on the slider
  let milestones = [];
  milestones.length = measures.length;

  for (var i = 0; i < measures.length; i++) {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const deltaT = (Date.parse(measures[i].startDate) - startDate);
    milestones[i] = Math.floor(deltaT / (1000 * 60 * 60 * 24));
  }
  console.log(milestones);

  stackedBar.update(trace, milestones);

  for (var i = 0; i < measures.length; i++) {
    measureIndex = measures.length - 1 - i;
    var endpoint = stackedBar.stack[0].selectAll("line").nodes()[milestones[measureIndex]]
    var stack = endpoint.getBBox();
    var ctm = endpoint.getCTM();

    let showMarker = true;
    if (showMarker) {
      lines[i].attr("x2", stack.x)
        .attr("y2", height)
        .attr("x1", stack.x)
        .attr("y1", height + 22 + measureSeperationY * (i))
        .style("visibility", "visible");
      r[i].attr("marker-end", "url()");

      //lines[i].style("visibility", "hidden");
      r[i].attr("marker-end", "url(#arrowhead" + i + ")");
    }

    r[i].attr("x1", (stackedBar.X(milestones[measureIndex])) + "px");
    r[i].attr("x2", (stackedBar.X(numDays - 1)) + "px");

    setTM(progressmeter.node(), ctm);
  }
}