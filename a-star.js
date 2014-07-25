function calcPaths(map, pos, place) {
    pos[2] = 0;
    var res = [],
        subRes = [pos];

    res.set(pos, 0);

    while(subRes.length) {
        pos = subRes.extractMinBy3();

        for(var d = 0; d < 4; d++) {
            var newPos = shiftDir(pos, d),
                t = CAN_GO[map.get(pos)];

            if(map.get(newPos) in CAN_GO && typeof res.get(newPos) === 'undefined') {
                res.set(newPos, newPos[2] = pos[2] + t);
                subRes.push(newPos);
            }
        }
    }

    return res;
}

function calcSmell(map, paths) {
    var res = [],
        sortedPaths = paths.flatAndSort();
    for(var i = 0; i < sortedPaths.length; i++) {
        var pos = sortedPaths[i];
        res.set(pos, (res.get(pos) || 0) + BOUNTY[map.get(pos)]);
        for(var d = 0; d < 4; d++) {
            var newPos = shiftDir(pos, d);

            if(!(map.get(newPos) in CAN_GO)) continue;

            if(paths.get(pos) > paths.get(newPos)) {
                res.set(newPos, Math.max(res.get(newPos) || 0, res.get(pos) * SMELL_ALPHA));
            }
        }
    }
    return res;
}

var CAN_GO = {
        '\\' : 0,
        ' ' : 127,
        '.' : 137,
        'o' : 137,
        '%' : 137
        // TODO: ghost
    },
    BOUNTY = {
        ' ' : 0,
        '.' : 10,
        'o' : 50, // TODO: use current state
        '%' : 1000 // TODO: use time to fruit
        // TODO: ghost
    },
    SMELL_ALPHA = 0.9;

function shiftDir(pos, d) {
    return d === 0 ?
        [pos[0], pos[1] - 1] :
        d === 1 ?
            [pos[0] + 1, pos[1]] :
            d === 2 ?
                [pos[0], pos[1] + 1] :
                [pos[0] - 1, pos[1]];
}

Array.prototype.set = function(pos, val) {
    (this[pos[0]] || (this[pos[0]] = []))[pos[1]] = val;
    return this;
};

Array.prototype.get = function(pos) {
    return (this[pos[0]] || (this[pos[0]] = []))[pos[1]];
};

Array.prototype.extractMinBy3 = function() {
    var minVal = Infinity, minIdx = 0;
    for(var i = 0; i < this.length; i++) {
        if(this[i][2] < minVal) {
            minVal = this[i][2];
            minIdx = i;
        }
    };
    return this.splice(minIdx, 1)[0];
};

Array.prototype.flatAndSort = function() {
    var res = [];
    for(var i = 0; i < this.length; i++) {
        var row = this[i] || [];
        for(var j = 0; j < row.length; j++) {
            if(typeof row[j] !== 'undefined') {
                res.push([i, j, row[j]]);
            }
        }
    }
    return res.sort(function(a, b) { return b[2] - a[2] });
};

function toHtml(map, arr) {
    var res = '<table border="1" cellspacing="0" cellpadding="0">';
    for(var i = 0; i < map.length; i++) {
        var mapRow = map[i],
            row = arr[i] || [];
        res += '<tr>';
        for(var j = 0; j < mapRow.length; j++) {
            res += '<td>' +
                mapRow[j] +
                '<sup>' + (typeof row[j] === 'undefined' ? '' : row[j]) + '</sup>' +
                '</td>';
        }
        res += '</tr>';
    }
    return res += '</table>'
}

var FS = require('fs'),
    map = FS.readFileSync('map1.txt', 'utf8').split('\n');
FS.writeFileSync('map1.html', toHtml(map, calcSmell(map, calcPaths(map, [16, 11]))));
