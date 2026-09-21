// Iisang lugar para sa iskedyul ng Sunday worship. Ang home page, ang I'm New page, at ang footer ay dito kumukuha.
// (Ang Events page ay may sarili pa ring kopya ng oras sa Pilipinas.)

export const WORSHIP = {
  title: "Sunday Worship",
  day: "Sunday",
  displayTime: "9:00 AM", // oras sa Pilipinas
  location: "Medina, Magallanes, Cavite, Philippines",
  streamUrl: "https://idbcj13708.online.church/",
};

// Lokal na worship sa Sto. Tomas, Batangas: tuwing Linggo, dalawang oras (oras sa Pilipinas).
export const WORSHIP_BATANGAS = {
  day: "Sunday",
  displayTimes: ["9:00 AM", "3:00 PM"],
  location: "Sta. Teresita, Sto. Tomas, Batangas, Philippines",
};

// Sa Fort McMurray, Alberta ay may sariling worship (hindi ito conversion ng oras sa Pilipinas).
export const WORSHIP_ALBERTA = {
  day: "Sunday",
  displayTime: "7:00 PM",
  location: "Fort McMurray, Alberta, Canada",
};
