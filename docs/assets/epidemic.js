
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const updateInfoText = (g, data, xScale, yScale, width, height, model, dayOfInterest, infoText) => {

  let text = g.select("text");
  let rect = g.select("rect");
  if (text.empty()) {
    rect = g.append("rect");
    text = g.append("text");
  }

  const lines = infoText.split(/\n/);
  const margin = 2;

  let x = xScale(dayOfInterest);
  const y = Math.max(margin * 2, yScale(data[dayOfInterest][0]) - 20);

  text.attr("class", "figtext2")
    .attr("style", "position:absolute; left:" + dayOfInterest + "px; top:0px")
    .attr("x", x)
    .attr("y", y)
    .attr("dy", 0)
    .attr("fill", "grey");

  text.selectAll("tspan").remove();

  let tspans = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const tspan = text.append("tspan");
    tspan.attr("x", 0).attr("y", y).attr("dy", (index * 1.1) + "em").text(line);
    tspans.push(tspan);
  }

  const bbox = text.node().getBBox();

  if (x < width / 2) {
    x = x + 20;
  } else {
    x = x - bbox.width - 20;
  }

  for (let index = 0; index < lines.length; index++) {
    let tspan = tspans[index];
    tspan.attr("x", x);
  }
  text.attr("x", x);

  rect.attr("x", x - margin)
    .attr("y", bbox.y - margin)
    .attr("rx", margin)
    .attr("ry", margin)
    .attr("width", bbox.width + margin * 2)
    .attr("height", bbox.height + margin * 2)
    .attr("stroke-width", 1)
    .attr("stroke", "#444")
    .attr("fill", "white");
};

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
  polygon.exit().remove();
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
        } else if (dayOffset + d.index < 0) {
          y1 = -200;
          y2 = -200;
          y3 = -200;
        } else if (d.index < caseDayIndex) {
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
    });
};

const epidemicChartCallbacks = {
  dataType: "",
  showR: true,
  startDate: 0,
  epidemicModel: null,
  epidemicData: null,
  epidemicDataSource: null,
  epidemicChartUpdate: null,
  overlay: null,
  transform: null,
  alpha: 0,
  _infoText: null,
  _g: null,
  _data: null,
  _xScale: null,
  _yScale: null,
  _width: 0,
  _height: 0,
  _hideTimeoutId: 0,
  updateCustomElements: (data, xScale, yScale, width, height) => {
    let g = epidemicChartCallbacks.overlay.select("#epidemicChart");
    if (g.empty()) {
      g = epidemicChartCallbacks.overlay.append("g").attr("id", "epidemicChart");
      g.attr("transform", epidemicChartCallbacks.transform);
      epidemicChartCallbacks._g = g.append("g");
      epidemicChartCallbacks._infoText = g.append("g");
    }
    epidemicChartCallbacks._data = data;
    epidemicChartCallbacks._xScale = xScale;
    epidemicChartCallbacks._yScale = yScale;
    epidemicChartCallbacks._width = width;
    epidemicChartCallbacks._height = height;
  },
  getBarTitle: (values, index, stackIndex) => {
    const a = epidemicChartCallbacks;

    let infectedCases = 0;
    for (let i = index + 1; i < a.epidemicData.length; i++) {
      //const p_ij = a.epidemicModel.computeWeightedInfectedLikelihood(i - index);
      infectedCases += a.epidemicData[i][0]; // * p_ij; // Stack0 represents already the epidemic relation to the index case
    }
    const rValue = infectedCases / a.epidemicData[index][0];
    const isValidRValue = (index + a.epidemicModel.getCenterCaseDayIndex() < a.epidemicData.length);

    const typeString = (a.dataType == "pcr_tests_100k") ? "Number of Cases per 100K PCR tests" : "Number of Cases"
    const date = new Date(a.startDate + index * MS_PER_DAY);
    return date.toLocaleDateString() + " - " + typeString + ": " + values[stackIndex] + "\n" +
      (a.showR ? ("Reproduction Number: " + (isValidRValue ? rValue.toFixed(2) : "n/a")) : "");
  },
  onMouseEnter: (values, index, stackIndex) => {
    const a = epidemicChartCallbacks;

    if (a.alpha < 0.2) {
      return;
    }

    clearTimeout(a._hideTimeoutId);

    for (let i = 0; i < a.epidemicData.length && a.showR; i++) {

      const p_ij = epidemicChartCallbacks.epidemicModel.computeWeightedInfectedLikelihood(Math.abs(i - index));
      const isCaseDay = (i === index);

      if (isCaseDay) {
        a.epidemicData[i][0] = a.epidemicDataSource[i][0];
        a.epidemicData[i][1] = 0;
      } else {
        a.epidemicData[i][0] = a.epidemicDataSource[i][0] * p_ij;
        a.epidemicData[i][1] = a.epidemicDataSource[i][0] * (1 - p_ij);
      }
    }

    const infoText = a.getBarTitle(values, index, stackIndex);

    if (a.showR)
      updateArrows(a._g, a._data, a._xScale, a._yScale, a._width, a._height, a.epidemicModel, index);
    updateInfoText(a._infoText, a._data, a._xScale, a._yScale, a._width, a._height, a.epidemicModel, index, infoText);
    epidemicChartCallbacks.epidemicChartUpdate();
    a._g.style("visibility", "visible");
    a._infoText.style("visibility", "visible");
  },
  onMouseOut: (values, index, stackIndex) => {
    const a = epidemicChartCallbacks;

    if (a.alpha < 0.2) {
      return;
    }

    a._hideTimeoutId = setTimeout(() => {
      a._infoText.style("visibility", "hidden");
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
  overlay: null,
  transform: null,
  _infoText: null,
  _g: null,
  _data: null,
  _xScale: null,
  _yScale: null,
  _width: 0,
  _height: 0,
  updateCustomElements: (data, xScale, yScale, width, height) => {
    let g = likelihoodChartCallbacks.overlay.select("#likelihoodOverlay");
    if (g.empty()) {
      g = likelihoodChartCallbacks.overlay.append("g").attr("id", "likelihoodOverlay");
      g.attr("transform", likelihoodChartCallbacks.transform);
      likelihoodChartCallbacks._g = g.append("g");
      likelihoodChartCallbacks._infoText = g.append("g");
    }
    likelihoodChartCallbacks._data = data;
    likelihoodChartCallbacks._xScale = xScale;
    likelihoodChartCallbacks._yScale = yScale;
    likelihoodChartCallbacks._width = width;
    likelihoodChartCallbacks._height = height;
    updateArrows(likelihoodChartCallbacks._g, data, xScale, yScale, width, height, likelihoodChartCallbacks.epidemicModel);
  },
  getBarTitle: (values, index, stackIndex) => {
    const caseDayIndex = likelihoodChartCallbacks.epidemicModel.getCenterCaseDayIndex();
    if (values[0] === 0) {
      return index < caseDayIndex ? "This case cannot infect case 𝑗." : "This case was not infected by case 𝑗.";
    }

    return index < caseDayIndex ? "This case infects case 𝑗 with a likelihood of " + (values[0] * 100).toPrecision(2) + "%." :
      index > caseDayIndex ? "This case has been infected by case 𝑗 with a likelihood of " + (values[0] * 100).toPrecision(2) + "%." :
        "Case 𝑗 has been infected by one of the prior\ncases and may infect upcoming cases.";
  },
  onMouseEnter: (values, index, stackIndex) => {
    const a = likelihoodChartCallbacks;

    const infoText = a.getBarTitle(values, index, stackIndex);

    a._infoText.style("visibility", "visible");
    updateInfoText(a._infoText, a._data, a._xScale, a._yScale, a._width, a._height, a.epidemicModel, index, infoText);
  },
  onMouseOut: (values, index, stackIndex) => {
    const a = likelihoodChartCallbacks;
    a._infoText.style("visibility", "hidden");
  }
};


function renderEpidemic(svg, epidemicData, measuresData, region) {

  let startDate = Date.parse(epidemicData.startDate);
  const showR = !epidemicData.type.includes("ratio");

  let epidemicSeriesData = epidemicData.data;

  if (region.roiDateStart) {
    const newStartDate = Date.parse(region.roiDateStart);
    const diffDays = Math.floor((newStartDate - startDate) / MS_PER_DAY);
    startDate = newStartDate;

    epidemicSeriesData = [];
    epidemicSeriesData.length = epidemicData.data.length - diffDays;
    for (let i = 0; i < epidemicSeriesData.length; i++) {
      epidemicSeriesData[i] = epidemicData.data[i + diffDays] || 0;
    }
  }

  const numDays = epidemicSeriesData.length;
  const measures = [...measuresData.measures].reverse();

  const numStacks = 2;
  const epidemicModel = new EpidemicModel(5, -1, 5);

  epidemicChartCallbacks.epidemicModel = epidemicModel;
  likelihoodChartCallbacks.epidemicModel = epidemicModel;

  let maxValue = 0;
  const measureColors = colorbrewer.Reds[Math.min(Math.max(measures.length, 3), 9)];

  const getMeasureColor = (index) => {
    return measureColors[(measures.length - 1 - index) % measureColors.length];
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

  let markers = [];
  for (let i = 0; i < measures.length; i++) {
    let marker = svg.append("defs").append("marker")
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

  const translatex = 110;
  const translatey = 10;
  let epidemicGraphsvg = svg.append("g").attr("transform", "translate(" + translatex + "," + translatey + ")");
  let likelihoodGraphsvg = svg.append("g").attr("transform", "translate(" + (translatex + 10) + "," + (translatey + 380) + ")");

  const xAxis = (d) => { return new Date(startDate + d * MS_PER_DAY).toLocaleDateString() };
  let stackedBar = stackedBarchartGen(numDays, numStacks, epidemicChartCallbacks)(epidemicGraphsvg, width, height, xAxis);
  let likelihoodWeightsGraph = stackedBarchartGen(epidemicModel.getInfectionInOutPeriodDays(), numStacks, likelihoodChartCallbacks)(likelihoodGraphsvg, 400, 100);

  let rValueGraphSvg = epidemicGraphsvg.append("g");

  const measureSeperationY = 14;

  let arrows = [];
  let lines = [];
  let linesDashed = [];

  let controlMeasureTimeline = svg.append("g");
  for (let i = 0; i < measures.length; i++) {

    measures[i].startDate = Array.isArray(measures[i].startDate) ? measures[i].startDate : [measures[i].startDate];
    measures[i].description = Array.isArray(measures[i].description) ? measures[i].description : [measures[i].description];
    measures[i].endDate = Array.isArray(measures[i].endDate) ? measures[i].endDate : [measures[i].endDate];
    measures[i].startDays = [];
    measures[i].endDays = [];

    for (let d = 0; d < measures[i].startDate.length; d++) {
      const deltaT = (Date.parse(measures[i].startDate[d]) - startDate);
      measures[i].startDays[d] = Math.floor(deltaT / MS_PER_DAY);

      const endDate = Date.parse(measures[i].endDate[d]);
      if (endDate > 0) {
        const deltaTEnd = (endDate - startDate);
        measures[i].endDays[d] = Math.floor(deltaTEnd / MS_PER_DAY);
      } else {
        measures[i].endDays[d] = 0;
      }
    }


    for (let d = 0; d < measures[i].startDate.length; d++) {

      const y = (height + 20 + i * measureSeperationY);
      const arrow = controlMeasureTimeline.append("line")
        .attr("y1", y + "px")
        .attr("stroke", getMeasureColor(i))
        .attr("y2", y + "px")
        .attr("stroke-width", 4);
      arrows.push(arrow);

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
  }

  let trace = [];
  const updateTrace = (smoothData, offsetDays) => {
    trace.length = numDays - offsetDays;

    const smoothingFactor = 0.5;
    //const smoothing = new zodiac.HoltSmoothing(epidemicSeriesData, smoothingFactor, 0.1);
    //const data = (smoothingFactor > 0.0) ? smoothing.predict() : epidemicSeriesData;
    const weeklyValueAreDailyValues = (epidemicData.type !== "cases");
    const smoothing = new TimeSeriesSmoothing(smoothingFactor);
    const data = smoothData ? smoothing.smoothSeries(epidemicSeriesData, weeklyValueAreDailyValues) : epidemicSeriesData;
    const smoothMaxValue = Math.max(...data);
    const originalMaxValue = Math.max(...epidemicSeriesData);
    const smoothingRatio = originalMaxValue / smoothMaxValue;

    if (smoothingRatio < 1.5) {
      maxValue = originalMaxValue;
    } else {
      maxValue = smoothMaxValue;
    }

    for (let i = 0; i < trace.length; i++) {
      trace[i] = [0, 0];
      trace[i][0] = data[i + offsetDays];
      trace[i][1] = 0.0;
    }
  };
  updateTrace(false, 0);



  const updateSaturationPlot = (graphSvg, rPlot, Y) => {

    const color = "#FF8820";
    const updatePlot = plot2dGen((x) => { return stackedBar.X(x); }, (y) => { return Y(y); }, () => { return color; }, color, 2, 0)(graphSvg);

    const windowSize = 10;
    const saturationPlot = [];
    for (let dayIndex = windowSize; dayIndex < rPlot.length - windowSize; dayIndex++) {

      let accR = 0;
      for (let i = dayIndex - windowSize; i <= dayIndex + windowSize; i++) {
        accR += rPlot[i][1];
      }

      const meanR = accR / (windowSize * 2 + 1);
      const saturation = 1.0 / meanR;

      saturationPlot.push([rPlot[dayIndex][0], saturation]);
    }

    updatePlot(saturationPlot);
  }

  const updateRPlot = (showSaturation) => {

    const Y = d3.scaleLinear().domain([3, 0]).range([0, stackedBar.height]);

    rValueGraphSvg.selectAll("*").remove();
    let graphsvg = rValueGraphSvg.append("g");
    let scaleSvg = rValueGraphSvg.append("g");

    const color = "#202020";
    const updatePlot = plot2dGen((x) => { return stackedBar.X(x); }, (y) => { return Y(y); }, () => { return color; }, color, 1)(graphsvg);

    let rPlot = [];
    for (let dayIndex = 0; dayIndex < trace.length; dayIndex++) {

      const numSourceCases = trace[dayIndex][0];
      const isValidRValue = (dayIndex + epidemicModel.getCenterCaseDayIndex() < trace.length) && (numSourceCases > 20);

      if (!isValidRValue) {
        continue;
      }

      let infectedCases = 0;
      for (let i = dayIndex + 1; i < trace.length; i++) {
        const p_ij = epidemicModel.computeWeightedInfectedLikelihood(i - dayIndex);

        infectedCases += trace[i][0] * p_ij;
      }

      const rValue = infectedCases / numSourceCases;

      rPlot.push([dayIndex, rValue]);
    }

    if (showR) {
      updatePlot(rPlot);
    }

    scaleSvg
      .attr("class", "grid")
      .attr("transform", "translate(" + width + ",0)")
      .attr("opacity", 0.25)
      .call(d3.axisLeft(Y)
        .ticks(3)
        .tickSize(2));

    if (showR) {
      rValueGraphSvg.append("line")
        .style("stroke", "black")
        .style("stroke-width", 1.0)
        .style("stroke-dasharray", "4")
        .attr("opacity", 0.6)
        .attr("x2", stackedBar.X(0))
        .attr("y2", Y(1.0))
        .attr("x1", stackedBar.X(trace.length))
        .attr("y1", Y(1.0))
        .style("visibility", "visible");
    }

    if (showSaturation && showR) {
      updateSaturationPlot(rValueGraphSvg.append("g"), rPlot, Y);
    }
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

    likelihoodWeightsGraph.update(likelihoodWeights, maxValue, Math.max(0.25, alpha), null, tickLabels);
  }

  const updateChart = (alpha, smoothData, showSaturation, offsetDays, overlay) => {


    updateTrace(smoothData, offsetDays);

    updateRPlot(showSaturation);

    likelihoodChartCallbacks.overlay = overlay;
    likelihoodChartCallbacks.transform = likelihoodGraphsvg.attr("transform");
    updateLikelihoodWeights(alpha);

    epidemicChartCallbacks.overlay = overlay;
    epidemicChartCallbacks.transform = epidemicGraphsvg.attr("transform");
    epidemicChartCallbacks.dataType = epidemicData.type;
    epidemicChartCallbacks.showR = showR;
    epidemicChartCallbacks.startDate = startDate;
    epidemicChartCallbacks.epidemicData = trace;
    epidemicChartCallbacks.epidemicDataSource = JSON.parse(JSON.stringify(trace));
    epidemicChartCallbacks.alpha = alpha;
    epidemicChartCallbacks.epidemicChartUpdate = () => {
      stackedBar.update(trace, maxValue, alpha, 5);
    };
    epidemicChartCallbacks.epidemicChartUpdate();

    let index = 0;
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];

      for (let d = 0; d < measure.startDays.length; d++) {
        const startDateText = new Date(Date.parse(measure.startDate[d])).toLocaleDateString();
        const endDateText = (measure.endDays[d] != 0) ? (" - " + new Date(Date.parse(measure.endDate[d])).toLocaleDateString()) : "";
        const toolTip = startDateText + endDateText + ": " + measure.description[d];

        var endpoint = stackedBar.stack[0].selectAll("line").nodes()[measure.startDays[d]];

        if (!endpoint) {
          index++;
          continue;
        }

        var stack = endpoint.getBBox();
        var ctm = endpoint.getCTM();

        let showMarker = true;
        if (showMarker) {
          lines[index].attr("x2", stack.x)
            .attr("y2", height)
            .attr("x1", stack.x)
            .attr("y1", height + 22 + measureSeperationY * (i))
            .style("visibility", "visible")
            .append("title").html(toolTip);

          linesDashed[index].attr("x2", stack.x)
            .attr("y2", height)
            .attr("x1", stack.x)
            .attr("y1", -10)
            .style("visibility", "visible")
            .append("title").html(toolTip);
        }

        arrows[index].attr("x1", (stackedBar.X(measure.startDays[d]) + 0.75) + "px")
          .attr("x2", stackedBar.X((measure.endDays[d] != 0) ? measure.endDays[d] : numDays - 1) + "px")
          .attr("marker-end", "url(#arrowhead" + i + ")")
          .append("title").html(toolTip);

        setTM(controlMeasureTimeline.node(), ctm);

        index++;
      }
    }
  };

  return updateChart;
}