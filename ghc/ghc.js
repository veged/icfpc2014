#!/usr/bin/env node

function read(cb) {
  var data = '';

  process.stdin.resume();

  process.stdin.on('data', function(chunk) {
    data += chunk;
  });

  process.stdin.on('end', function() {
    cb(data);
  });
}

read(function(src) {
  var lines = src.split(/[\r\n]/g);

  lines = lines.map(function(line) {
    return line.replace(/\s*;.*$/g, '').trim();
  }).filter(function(line) {
    return line.length !== 0;
  });

  // Collect labels
  var labels = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var match = line.match(/^([\w\d]+):\s*/i);
    if (match === null)
      continue;

    labels[match[1]] = i;
    lines[i] = line.slice(match[0].length);

    // Skip the line
    if (line.length === 0) {
      lines.splice(i, 1);
      i--;
    }
  }

  // Replace labels with offsets
  lines = lines.map(function(line) {
    return line.replace(/\.([\w\d]+)/g, function(all, label) {
      if (labels[label] === undefined)
        return all;

      return labels[label];
    });
  });

  console.log(lines.join('\n'));
});
