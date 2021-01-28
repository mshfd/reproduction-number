class TimeSeriesSmoothing {
  constructor(alpha) {
    this._alpha = alpha;

    this.smoothSeries = function (data) {

      let numZeroValues = 0;
      let smoothedData = [];
      smoothedData.length = data.length;
      for (let n = 0; n < data.length; n++) {
        smoothedData[n] = data[n];

        // fix weekly values
        if (data[n] === 0) {
          numZeroValues++;
        }
        else if (numZeroValues >= 6) {
          numZeroValues = 0;
          for (let prev6 = 1; prev6 < 7; prev6++) {
            smoothedData[n - prev6] = data[n];
          }
        }
      }

      // smooth negative values before smoothing
      let hasNegativeValues = true;
      while (hasNegativeValues) {
        hasNegativeValues = false;
        for (let n = 0; n < data.length; n++) {
          if (smoothedData[n] < 0) {
            hasNegativeValues = true;
            smoothedData[n] += 2;
            smoothedData[n - 1] -= 1;
            smoothedData[n + 1] -= 1;
          }
        }
      }

      const threshold = this._alpha;
      const invThreshold = 1.0 / this._alpha;

      let iterationIndex = 0;
      let error = 1;
      while (error > 0 && iterationIndex < 100000) {
        iterationIndex++;
        error = 0;
        for (let n = 1; n < smoothedData.length - 1; n++) {
          const l = smoothedData[n - 1];
          const c = smoothedData[n];
          const r = smoothedData[n + 1];

          const cl = c - l;
          const rc = r - c;
          const part = Math.max(2, c * 0.001);

          if (cl < 0 && rc > 0 && l > 0 && r > 0) {
            error++;
            smoothedData[n - 1]--;
            smoothedData[n] += 2;
            smoothedData[n + 1]--;
          } else if (cl > 0 && rc < 0 && c > 1) {
            error++;
            smoothedData[n - 1]++;
            smoothedData[n] -= 2;
            smoothedData[n + 1]++;
          } else if (cl >= 0 && rc > part) {

            const dx = cl / rc;
            if (dx < threshold && r > 0) {
              error++;
              smoothedData[n]++;
              smoothedData[n + 1]--;
            } else if (dx > invThreshold && c > 0) {
              error++;
              smoothedData[n]--;
              smoothedData[n - 1]++;
            }
          } else if (cl < -part && rc <= 0) {

            const dx = rc / cl;
            if (dx > invThreshold && c > 0) {
              error++;
              smoothedData[n]--;
              smoothedData[n + 1]++;
            } else if (dx < threshold && r > 0) {
              error++;
              smoothedData[n]++;
              smoothedData[n - 1]--;
            }
          }
        }
      }

      return smoothedData;
    };
  }
}