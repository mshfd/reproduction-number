class EpidemicModel {
  constructor(numIncubationDays, symptomOnsetInfectivityOffsetInDays, infectivityPeriodDays) {
    this._numIncubationDays = numIncubationDays;
    this._symptomOnsetInfectivityOffsetDays = symptomOnsetInfectivityOffsetInDays;
    this._infectivityPeriodDays = infectivityPeriodDays;
    this._generationIntervalDays = numIncubationDays + symptomOnsetInfectivityOffsetInDays;

    this._infectedLikelihoodModel = function (index) {
      // TODO: Allow different models here (e.g. WHO says asymptomatic cases are rarely infectious).
      // This is what RKI uses for COVID-19 
      return index >= 0 && index < 1.0 ? 1.0 : 0.0;
    }

    this._computeInfectedLikelihood = function (offsetDay) {
      const indexDay = offsetDay - this._generationIntervalDays;
      return this._infectedLikelihoodModel(indexDay / (this._infectivityPeriodDays - 1));
    };

    this.getGenerationIntervalDays = function () {
      return this._generationIntervalDays;
    }

    this.getInfectionInOutPeriodDays = function () {
      return this._generationIntervalDays * 4 - 1;
    }

    this.getCenterCaseDayIndex = function () {
      return this._generationIntervalDays * 2 - 1;
    }

    this.computeWeightedInfectedLikelihood = function (offsetDay) {
      // P.T. Jacco Wallinga 2004 [https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7110200/]
      // The relative likelihood that cases i have been infected by case j.

      let sum_wt_ik = 0;
      for (let t_k = 0; t_k < this._infectivityPeriodDays; t_k++) {
        const wt_ik = this._computeInfectedLikelihood(t_k + this._generationIntervalDays);
        sum_wt_ik += wt_ik;
      }

      const wt_ij = this._computeInfectedLikelihood(offsetDay);
      const p_ij = wt_ij / sum_wt_ik;
      return p_ij;
    };
  }


}