/* ══════════════════════════════════════════════════════════
   2048 규칙 — 직접 짜지 않고 **검증된 오픈 소스를 그대로** 가져왔습니다.

     출처 : winsonwq/2048term  (npm 패키지 `2048`, 버전 0.2.2)
     저작 : Wang Qiu <winsonwq@gmail.com>
     허가 : MIT License

   원본은 터미널용 CommonJS 모듈입니다. 여기서는 브라우저에서 쓰려고
   require/module.exports 만 ESM 으로 바꿨고 **규칙 코드는 한 줄도
   고치지 않았습니다.** 원본에는 이 규칙을 검사하는 mocha 시험이
   함께 들어 있습니다(row_calc_spec.js, table_calc_spec.js).

   MIT License

   Permission is hereby granted, free of charge, to any person obtaining a
   copy of this software and associated documentation files (the "Software"),
   to deal in the Software without restriction, including without limitation
   the rights to use, copy, modify, merge, publish, distribute, sublicense,
   and/or sell copies of the Software, and to permit persons to whom the
   Software is furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
   THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
   DEALINGS IN THE SOFTWARE.
   ══════════════════════════════════════════════════════════ */

const RowCalc = {
  LTR: 'ltr',
  RTL: 'rtl',
  merge: function (nums, mode) {
    var mod = mode || RowCalc.LTR;

    if (mod == RowCalc.LTR) {
      return this._ltrMerge(nums);
    } else if (mod == RowCalc.RTL){
      var ret = this._ltrMerge(nums.reverse());
      nums.reverse();
      return { result: ret.result.reverse(), mergedNums: ret.mergedNums };
    }
  },
  _ltrMerge: function(nums) {
    var newNums = [];
    var mergedNums = [];
    for (var i = nums.length - 1; i >= 0; i--) {
      var num = nums[i];

      if (num == 0) continue;
      while (i - 1 >= 0 && nums[i - 1] == 0) i--;

      if (num == nums[i - 1] ) {
        newNums.unshift(num + nums[i - 1]);
        mergedNums.push(num + nums[i - 1]);

        i--;
      } else {
        newNums.unshift(num);
      }
    }

    var fixedZeroLength = nums.length - newNums.length;
    for (var i = 0; i < fixedZeroLength; i++) {
      newNums.unshift(0);
    }

    return {
      result: newNums,
      mergedNums: mergedNums
    };
  }
};

const rowCalc = RowCalc;

const TableCalc = {
  LTR: 'ltr',
  RTL: 'rtl',
  TTB: 'ttb',
  BTT: 'btt',
  merge: function (tableNums, mode) {
    var mod = mode || TableCalc.LTR;
    if (mod == TableCalc.LTR || mod == TableCalc.RTL) {
      return this._merge(tableNums, mod);

    } else if (mod == TableCalc.TTB) {
      var ret = this.merge(this.transform(tableNums), TableCalc.LTR);
      return { result: this.transform(ret.result), mergedNums: ret.mergedNums };

    } else if (mod == TableCalc.BTT) {
      var ret = this.merge(this.transform(tableNums), TableCalc.RTL);
      return { result: this.transform(ret.result), mergedNums: ret.mergedNums };
    }
  },
  _merge: function (tableNums, mode) {
    var newTableNums = [];
    var mergedNums = [];

    tableNums.forEach(function (rowNums) {
      var ret = rowCalc.merge(rowNums, mode);
      newTableNums.push(ret.result);
      mergedNums.push(ret.mergedNums);
    });

    return {
      result: newTableNums,
      mergedNums: mergedNums
    };
  },
  transform: function (tableNums) {
    var newTable = [];
    tableNums.forEach(function(rowNums, rowIdx) {
      rowNums.forEach(function(num, columnIdx) {
        newTable[columnIdx] = newTable[columnIdx] || [];
        newTable[columnIdx].push(tableNums[rowIdx][columnIdx]);
      });
    });

    return newTable;
  },
  isSame: function (tableFrom, tableTo) {
    for (var i = 0; i < tableFrom.length; i++) {
      for (var j = 0; j < tableFrom[i].length; j++) {
        if (tableFrom[i][j] != tableTo[i][j]) {
          return false;
        }
      }
    }
    return true;
  }
};

export { RowCalc, TableCalc };
