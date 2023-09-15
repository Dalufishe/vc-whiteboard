import { useCallback, useEffect, useState } from "react";

// render card (threejs part) via id, and return data that react app need.

export default (WB) => {
  /**
   * $ renderer object
   * * x: number | undefined
   * * y: number | undefined
   * * z: number | undefined
   * * isLoad: boolean
   */
  const [renderer, setRenderer] = useState(null);

  useEffect(() => {

    if (WB) {
      // yao's code (may be a function call)
      // do the threejs rendering work, and provide data that react app need.
      // call setRenderer to update State
      // e.g. setRenderer({x: 1, y: 2, z: 3, isLoad: true})

      WB.API.on("cardMove", ({ id, x, y, width, height }) => {
        // WB.API.cardMove({ x, y, width, height, id });
      });

      WB.API.on("cardLoad", (id) => {
        // WB.API.cardLoad(id);
        // setRenderer({ ...renderer, ...{ id, isLoad: true } });
      })

      WB.API.on("cardSelect", ({ id, x, y, width, height }) => {
        // WB.API.cardSelect(x, y, width, height);
        setRenderer({ ...renderer, ...{ id, x, y, width, height } });
      })

      WB.API.on("cardLeave", (id) => {
        // WB.API.cardLeave(id);
        setRenderer({ ...renderer, ...{ id, isLeave: true } });

      })
    }

  }, [WB]);

  return renderer;
};
