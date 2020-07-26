
const updateArrows = (g, data, xScale, yScale, width, height, model, dayOfInterest) => {
  
  let arrows = [];
  const caseDayIndex = model.getCenterCaseDayIndex();
  const dayOffset = (dayOfInterest === undefined) ? 0 : dayOfInterest - caseDayIndex;
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

  const relativeHeightScale = 1.0 / generationIntervalDays;
  const heightScale = height * relativeHeightScale;
  const lineWidth = width / data.length;

  const polygon = g.selectAll("path").data(arrows);
  polygon.enter().append("path").merge(polygon)
    .style("stroke", "#000")
    .attr("stroke-width", 1.5)
    .style("fill", "none")
    .attr("marker-end", "url(#arrowhead)")
    .attr("d", function (d, i) {

      const isInfectious = d.index < caseDayIndex;
      const isInfected = d.index > caseDayIndex;

      const x1 = xScale(dayOffset + (isInfectious ? d.index : caseDayIndex)) + (isInfectious ? 0.0 : lineWidth * 0.5);
      const x2 = xScale(dayOffset + (isInfected ? d.index : caseDayIndex)) - (isInfected ? 0.0 : lineWidth * 0.5);
      let y1 = d.index < caseDayIndex ? height * (1 - d.p_ij) : height + (generationIntervalDays - i - 0.5) * heightScale;
      let y2 = d.index < caseDayIndex ? height + (i - generationIntervalDays + 0.5) * heightScale : height * (1 - d.p_ij);

      let yCurveScale = 0.75;
      let x3 = d.index < caseDayIndex ? x1 : x2;
      let y3 = d.index < caseDayIndex ? y1 + ((i - generationIntervalDays) * heightScale) * yCurveScale : y2 + ((generationIntervalDays - i - 1) * heightScale) * yCurveScale;

      if (dayOfInterest !== undefined) {
        if (dayOffset + d.index >= data.length) {
          y1 = -200;
          y2 = -200;
          y3 = -200;
        }
        else if (d.index < caseDayIndex) {
          y1 = yScale(data[dayOffset + d.index][0]);
          y2 = yScale(data[dayOffset + caseDayIndex][0] * (generationIntervalDays - i - 0.5) * relativeHeightScale);
          y3 = (y1 + y2) * 0.5;
        } else {
          y1 = yScale(data[dayOffset + caseDayIndex][0] * (i + 0.5 - generationIntervalDays) * relativeHeightScale);
          y2 = yScale(data[dayOffset + d.index][0]);
          y3 = (y1 + y2) * 0.5;
        }
      }

      return d3.line().curve(d3.curveBundle, 0.5)([[x1, y1], [x3, y3], [x2, y2]]);
    })
    .exit().remove();
};

const epidemicChartCallbacks = {
  startDate: 0,
  epidemicModel: null,
  epidemicData: null,
  epidemicDataSource: null,
  epidemicChartUpdate: null,
  _g: null,
  _data: null,
  _xScale: null,
  _yScale: null,
  _width: 0,
  _height: 0,
  _hideTimeoutId: 0,
  _R_i: -1,
  updateCustomElements: (g, data, xScale, yScale, width, height) => {
    epidemicChartCallbacks._g = g;
    epidemicChartCallbacks._data = data;
    epidemicChartCallbacks._xScale = xScale;
    epidemicChartCallbacks._yScale = yScale;
    epidemicChartCallbacks._width = width;
    epidemicChartCallbacks._height = height;
  },
  getBarTitle: (values, index, stackIndex) => {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const date = new Date(epidemicChartCallbacks.startDate + index * millisecondsPerDay);
    return date.toLocaleDateString() + " - Number of Cases: " + values[stackIndex] + "\n" +
      "Reproduction Number: " + ((epidemicChartCallbacks._R_i >= 0) ? epidemicChartCallbacks._R_i.toFixed(2) : "n/a");
  },
  onMouseEnter: (values, index, stackIndex) => {
    const a = epidemicChartCallbacks;

    clearTimeout(a._hideTimeoutId);

    let causedCases = 0;

    for (let i = 0; i < a.epidemicData.length; i++) {

      const p_ij = epidemicChartCallbacks.epidemicModel.computeWeightedInfectedLikelihood(Math.abs(i - index));
      const isCaseDay = (i === index);

      if (isCaseDay) {
        a.epidemicData[i][0] = a.epidemicDataSource[i][0];
        a.epidemicData[i][1] = 0;
      } else {
        if (i > index) {
          causedCases += a.epidemicDataSource[i][0] * p_ij;
        }
        a.epidemicData[i][0] = a.epidemicDataSource[i][0] * p_ij;
        a.epidemicData[i][1] = a.epidemicDataSource[i][0] * (1 - p_ij);
      }
    }

    if (index + epidemicChartCallbacks.epidemicModel.getCenterCaseDayIndex() < a.epidemicData.length) {
      a._R_i = causedCases / a.epidemicDataSource[index][0];
    } else {
      a._R_i = -1.0;
    }


    updateArrows(a._g, a._data, a._xScale, a._yScale, a._width, a._height, a.epidemicModel, index);
    epidemicChartCallbacks.epidemicChartUpdate();
    a._g.style("visibility", "visible");

  },
  onMouseOut: (values, index, stackIndex) => {
    const a = epidemicChartCallbacks;

    a._hideTimeoutId = setTimeout(() => {
      a._g.style("visibility", "hidden");

      for (var i = 0; i < a.epidemicData.length; i++) {
        a.epidemicData[i][0] = a.epidemicDataSource[i][0];
        a.epidemicData[i][1] = a.epidemicDataSource[i][1];
      }
      a.epidemicChartUpdate();
    }, 100);
  }
};

const likelihoodChartCallbacks = {
  epidemicModel: null,
  updateCustomElements: (g, data, xScale, yScale, width, height) => {
    updateArrows(g, data, xScale, yScale, width, height, likelihoodChartCallbacks.epidemicModel);
  },
  getBarTitle: (values, index, stackIndex) => {
    const caseDayIndex = likelihoodChartCallbacks.epidemicModel.getCenterCaseDayIndex();
    if (values[0] === 0) {
      return index < caseDayIndex ? "This case cannot infect case 𝑗." : "This case was not infected by case 𝑗.";
    }

    return index < caseDayIndex ? "This case infects case 𝑗 with a likelihood of " + (values[0] * 100).toPrecision(2) + "%." :
      index > caseDayIndex ? "This case has been infected by case 𝑗 with a likelihood of " + (values[0] * 100).toPrecision(2) + "%." :
        "Case 𝑗 has been infected by one of the prior cases and may infect upcoming cases.";
  }
};

function renderEpidemic(svg, epidemicData, measuresData) {
  const numDays = epidemicData.data.length;
  const measures = measuresData.measures;

  const numStacks = 2;
  const epidemicModel = new EpidemicModel(5, -1, 5);

  epidemicChartCallbacks.epidemicModel = epidemicModel;
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
  const updateTrace = (smoothData) => {
    trace.length = numDays;

    const smoothingFactor = 0.5;
    //const smoothing = new zodiac.HoltSmoothing(epidemicData.data, smoothingFactor, 0.1);
    //const data = (smoothingFactor > 0.0) ? smoothing.predict() : epidemicData.data;
    const smoothing =  new TimeSeriesSmoothing(smoothingFactor);
    const data = smoothData ? smoothing.smoothSeries(epidemicData.data) : epidemicData.data;

    for (var i = 0; i < numDays; i++) {
      trace[i] = [0, 0];
      trace[i][0] = data[i];
      trace[i][1] = 0.0;
    }
  };
  updateTrace(false);

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
      likelihoodWeights[i][1] = 1 - likelihoodWeights[i][0];
      maxValue = Math.max(maxValue, likelihoodWeights[i][0] + likelihoodWeights[i][1]);

      const iLabel = likelihoodWeights[i][0] ? "i" + Math.floor(i - caseDayIndex) : emptyLabel;
      emptyLabel = emptyLabel + " ";
      tickLabels[i] = (i == caseDayIndex) ? "j" : iLabel;
    }

    likelihoodWeightsGraph.update(likelihoodWeights, null, maxValue, Math.max(0.25, alpha), null, tickLabels);
  }

  const updateChart = (alpha, smoothData) => {

    updateTrace(smoothData);

    //updateRPlot();
    updateLikelihoodWeights(alpha);

    epidemicChartCallbacks.startDate = startDate;
    epidemicChartCallbacks.epidemicData = trace;
    epidemicChartCallbacks.epidemicDataSource = JSON.parse(JSON.stringify(trace));
    epidemicChartCallbacks.epidemicChartUpdate = () => {
      stackedBar.update(trace, measureDays, maxValue, alpha, 5);
    };
    epidemicChartCallbacks.epidemicChartUpdate();

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