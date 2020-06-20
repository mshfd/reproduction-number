function renderEpidemic(svg, epidemicData, measuresData) {
  const numDays = epidemicData.data.length;
  const measures = measuresData.measures;

  const maxValue = Math.max(...epidemicData.data);
  const measureColors = colorbrewer.Blues[measures.length];
  //TODO: check if measures and number colors are available

  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("refX", 3)
    .attr("refY", 2)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0,0 V 4 L4,2 Z"); //this is actual shape for arrowhead

  var markers = []
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
      .attr("fill", measureColors[measures.length - 1 - i])
    markers.push(marker)
  }


  var stackedBar = stackedBarchartGen(numDays, 2)(svg)

  var measureSeperationY = 14

  var r = []
  var lines = []

  var progressmeter = svg.append("g")
  for (var i = 0; i < measures.length; i++) {
    var ri = progressmeter.append("line")
      .attr("x1", stackedBar.X(-1) + "px")
      .attr("y1", (202 + i * measureSeperationY) + "px")
      .attr("stroke", measureColors[measures.length - 1 - i])
      .attr("y2", (202 + i * measureSeperationY) + "px")
      .attr("stroke-width", 4)
    r.push(ri)

    var linei = progressmeter.append("line")
      .style("stroke", "black")
      .style("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)")
      .attr("opacity", 0.6)
    lines.push(linei)

    progressmeter.append("text")
      .attr("class", "figtext2")
      .attr("x", 0)
      .attr("y", 206 + i * measureSeperationY)
      .attr("text-anchor", "end")
      .attr("fill", "gray")
      .html((i == 0) ? "Measure " + (measures.length - i) : (measures.length - i))
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
  for (var i = 0; i < numDays; i++) {
    milestones[2] = 100;
    milestones[1] = 90;
    milestones[0] = 70;
  }

  stackedBar.update(trace, milestones);

  for (var i = 0; i < measures.length; i++) {
    measureIndex = measures.length - 1 - i;
    var endpoint = stackedBar.stack[0].selectAll("line").nodes()[milestones[measureIndex]]
    var stack = endpoint.getBBox();
    var ctm = endpoint.getCTM();

    let showMarker = true;
    if (showMarker) {
      lines[i].attr("x2", stack.x)
        .attr("y2", 160)
        .attr("x1", stack.x)
        .attr("y1", 203.5 + measureSeperationY * (i))
        .style("visibility", "visible")
      r[i].attr("marker-end", "url()")

      //lines[i].style("visibility", "hidden")
      r[i].attr("marker-end", "url(#arrowhead" + i + ")")
    }

    r[i].attr("x1", (stackedBar.X(milestones[measureIndex])) + "px")
    r[i].attr("x2", (stackedBar.X(milestones[measureIndex] + 30)) + "px")

    setTM(progressmeter.node(), ctm)
  }
}