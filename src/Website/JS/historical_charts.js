document.addEventListener("DOMContentLoaded", function () {
  const ctxCpu = document.getElementById('cpuChart').getContext('2d');
  const ctxMemory = document.getElementById('memoryChart').getContext('2d');
  const currentTimeField = document.getElementById('currentTime');

  fetch('/history') // Changed '/historical' to '/history'
      .then(response => response.json())
      .then(data => {
          const isoTimestamps = data.timestamps.map(timestamp => `2024-04-09T${timestamp}`);

          // CPU Chart
          const cpuChart = new Chart(ctxCpu, {
              type: 'line',
              data: {
                  labels: isoTimestamps,
                  datasets: [{
                      label: 'CPU Usage (%)',
                      data: data.cpu_history,
                      borderColor: 'rgb(75, 192, 192)',
                      fill: false
                  }]
              },
              options: {
                  scales: {
                      x: {
                          type: 'time',
                          time: {
                              unit: 'second'
                          }
                      },
                      y: {
                          beginAtZero: true,
                          max: 100
                      }
                  }
              }
          });

          // Memory Chart
          const memoryChart = new Chart(ctxMemory, {
              type: 'line',
              data: {
                  labels: isoTimestamps,
                  datasets: [{
                      label: 'Memory Usage (%)',
                      data: data.memory_history,
                      borderColor: 'rgb(153, 102, 255)',
                      fill: false
                  }]
              },
              options: {
                  scales: {
                      x: {
                          type: 'time',
                          time: {
                              unit: 'second'
                          }
                      },
                      y: {
                          beginAtZero: true,
                          max: 100
                      }
                  }
              }
          });

          // Time Slider
          const timeSlider = document.getElementById('timeSlider');

          // Initialize noUiSlider
          noUiSlider.create(timeSlider, {
              start: isoTimestamps.length - 10, // Start value to display the last 30 data points
              connect: [true, false], // Connect the handle to the background
              range: {
                  'min': 0,
                  'max': isoTimestamps.length - 1
              }
          });

          timeSlider.noUiSlider.on('update', function (values, handle) {
              const index = parseInt(values[handle], 10);
              updateCharts(cpuChart, memoryChart, index);
          });

          // Display current time
          const currentTimeIndex = isoTimestamps.length - 1;
          currentTimeField.textContent = `Current Time: ${isoTimestamps[currentTimeIndex]}`;
      })
      .catch(error => console.error('Error fetching historical data:', error));

// Function to update charts based on selected time
function updateCharts(cpuChart, memoryChart, index) {
  const timestamps = cpuChart.data.labels;
  const totalPoints = timestamps.length;
  const pointsToShow = 10; // Number of data points to show after the selected index

  // Determine the starting point based on the slider position
  let startIndex = index;

  // Determine the end point, but make sure it does not exceed the available data points
  let endIndex = startIndex + pointsToShow;
  endIndex = endIndex > totalPoints ? totalPoints : endIndex;

  // Adjust the chart options to display the new range
  cpuChart.options.scales.x.min = timestamps[startIndex];
  cpuChart.options.scales.x.max = timestamps[endIndex - 1]; // -1 because endIndex is exclusive
  memoryChart.options.scales.x.min = timestamps[startIndex];
  memoryChart.options.scales.x.max = timestamps[endIndex - 1];

  cpuChart.update();
  memoryChart.update();

  // Update the current time indication
  currentTimeField.textContent = `Current Time: ${timestamps[startIndex]}`;
}
});