
const epidemicChartCallbacks = {
  startDate: 0,
  getBarTitle: (value, index) => {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const date = new Date(epidemicChartCallbacks.startDate + index * millisecondsPerDay);
    return date.toLocaleDateString() + " - Number of Cases: " + value;
  }
};

const likelihoodChartCallbacks = {
  epidemicModel: null,
  extrasG: null,
  addCustomElements: (g, data, xScale, width, height) => {
    likelihoodChartCallbacks.extrasG = g;
  },
  updateCustomElements: (data, xScale, width, height) => {

    let arrows = [];
    const model = likelihoodChartCallbacks.epidemicModel;
    const caseDayIndex = model.getCenterCaseDayIndex();
    const generationIntervalDays = model.getGenerationIntervalDays();
    for (var i = 0; i < model.getInfectionInOutPeriodDays(); i++) {

      const p_ij = model.computeWeightedInfectedLikelihood(Math.abs(i - caseDayIndex));
      if (p_ij === 0) {
        continue;
      }

      let arrow = {
        index: i,
        p_ij: p_ij
      };

      arrows.push(arrow);
    }

    const heightScale = height / generationIntervalDays;
    const lineWidth = width / data.length;

    const polygon = likelihoodChartCallbacks.extrasG.selectAll("path").data(arrows);
    polygon.enter().append("path").merge(polygon)
      .style("stroke", "#000")
      .attr("stroke-width", 1.5)
      .style("fill", "none")
      .attr("marker-end", "url(#arrowhead)")
      .attr("d", function (d, i) {

        const isInfectious = d.index < caseDayIndex;
        const isInfected = d.index > caseDayIndex;

        const x1 = xScale(isInfectious ? d.index : caseDayIndex) + (isInfectious ? 0.0 : lineWidth * 0.5);
        const x2 = xScale(isInfected ? d.index : caseDayIndex) - (isInfected ? 0.0 : lineWidth * 0.5);
        const y1 = d.index < caseDayIndex ? height * (1 - d.p_ij) : height + (generationIntervalDays - i - 0.5) * heightScale;
        const y2 = d.index < caseDayIndex ? height + (i - generationIntervalDays + 0.5) * heightScale : height * (1 - d.p_ij);

        const yCurveScale = 0.75;
        const x3 = d.index < caseDayIndex ? x1 : x2;
        const y3 = d.index < caseDayIndex ? y1 + ((i - generationIntervalDays) * heightScale) * yCurveScale : y2 + ((generationIntervalDays - i - 1) * heightScale) * yCurveScale;

        return d3.line().curve(d3.curveBundle, 0.5)([[x1, y1], [x3, y3], [x2, y2]]);
      })
      .exit().remove();
  },
  getBarTitle: (value, index) => {
    const caseDayIndex = likelihoodChartCallbacks.epidemicModel.getCenterCaseDayIndex();
    return index < caseDayIndex ? "This case infects case j with a likelihood of " + (value * 100).toPrecision(2) + "%." :
      index > caseDayIndex ? "This case has been infected by case j with a likelihood of " + (value * 100).toPrecision(2) + "%." :
        "Case j has been infected by prior cases and infects upcoming cases.";
  },
  onMouseOver: (value, index, element) => {

  }
};

function renderEpidemic(svg, epidemicData, measuresData) {
  const numDays = epidemicData.data.length;
  const measures = measuresData.measures;

  const numStacks = 2;
  const epidemicModel = new EpidemicModel(5, -1, 5);

  likelihoodChartCallbacks.epidemicModel = epidemicModel;

  const startDate = Date.parse(epidemicData.startDate);

  const maxValue = Math.max(...epidemicData.data);
  const measureColors = colorbrewer.Reds[Math.min(Math.max(measures.length, 3), 9)];

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

  var stackedBar = stackedBarchartGen(numDays, numStacks, epidemicChartCallbacks)(svg, width, height, false);

  let graphsvg = svg.append("g").attr("transform", "translate(" + 10 + "," + 380 + ")");
  let likelihoodWeightsGraph = stackedBarchartGen(epidemicModel.getInfectionInOutPeriodDays(), numStacks, likelihoodChartCallbacks)(graphsvg, 400, 100, false);

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

  const updateRPlot = () => {

    var graphsvg = svg.append("g").attr("transform", "translate(" + 110 + "," + 10 + ")")
    const updatePlot = plot2dGen((x) => { return x; }, (y) => { return y * 1; }, () => { return colorbrewer.YlGn[3][0]; })(graphsvg);

    updatePlot([[1, 2], [2, 4], [3, 2], [4, 6], [10, 12], [20, 30], [300, 60]]);
  }

  const updateLikelihoodWeights = (alpha) => {

    let likelihoodWeights = [];
    let tickLabels = [];
    likelihoodWeights.length = epidemicModel.getInfectionInOutPeriodDays();
    tickLabels.length = epidemicModel.getInfectionInOutPeriodDays();

    let maxValue = 0;
    let emptyLabel = "";
    const caseDayIndex = epidemicModel.getCenterCaseDayIndex();
    for (var i = 0; i < epidemicModel.getInfectionInOutPeriodDays(); i++) {
      likelihoodWeights[i] = [0, 0];

      const p_ij = epidemicModel.computeWeightedInfectedLikelihood(Math.abs(i - caseDayIndex));

      likelihoodWeights[i][0] = (i == caseDayIndex) ? 1 : p_ij;
      likelihoodWeights[i][1] = 0; //likelihoodWeights[i][0]; // without symptoms
      maxValue = Math.max(maxValue, likelihoodWeights[i][0] + likelihoodWeights[i][1]);

      const iLabel = likelihoodWeights[i][0] ? "i" + Math.floor(i - caseDayIndex) : emptyLabel;
      emptyLabel = emptyLabel + " ";
      tickLabels[i] = (i == caseDayIndex) ? "j" : iLabel;
    }

    likelihoodWeightsGraph.update(likelihoodWeights, null, maxValue, Math.max(0.25, alpha), null, tickLabels);
  }

  const updateChart = (alpha) => {

    //updateRPlot();
    updateLikelihoodWeights(alpha);

    epidemicChartCallbacks.startDate = startDate;
    stackedBar.update(trace, measureDays, maxValue, alpha, 5);

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
  };

  return updateChart;
}