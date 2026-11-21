import '@testing-library/jest-dom';
// jsdom has no native dialog implementation; browser QA covers focus trapping.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
}
