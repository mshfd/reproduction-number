class EpidemicModel {
  constructor(numIncubationDays, symptomOnsetInfectivityOffsetInDays) {
    this.numIncubationDays = numIncubationDays;
    this.symptomOnsetInfectivityOffsetDays = symptomOnsetInfectivityOffsetInDays;
    this.generationIntervalDays = numIncubationDays + symptomOnsetInfectivityOffsetInDays;
  }
}