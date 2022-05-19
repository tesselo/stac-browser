import axios from "axios";
import Utils from "../utils";
import proj4 from "proj4-fully-loaded";

export class Loading {
  
  constructor(show = false, loadApi = false) {
    this.show = Boolean(show);
    this.loadApi = Boolean(loadApi);
  }

}

export async function stacRequest(cx, link) {
  let opts;
  if (Utils.isObject(link)) {
    let method = typeof link.method === 'string' ? link.method.toLowerCase() : 'get'
    opts = {
      method,
      url: cx.getters.getRequestUrl(link.href),
      headers: Object.assign({}, cx.state.requestHeaders, link.headers),
      data: link.body
      // ToDo: Support for merge property from STAC API
    };
  }
  else if (typeof link === 'string') {
    opts = {
      method: 'get',
      url: cx.getters.getRequestUrl(link),
      headers: cx.state.requestHeaders
    };
  }
  else {
    opts = link;
  }
  return await axios(opts);
}

function getGeoCoordinatesConverted(array, stacEpsg) {
  const geoCoordinatesConverted = array.map((elem) => {
    if (typeof elem[0] === 'number') {
      return proj4(`${stacEpsg}`, "EPSG:4326", [elem[0], elem[1]]);
    } else {
      return getGeoCoordinatesConverted(elem, stacEpsg);
    }
  })
  return geoCoordinatesConverted;
}

function getBboxCoordinatesConverted(array, stacEpsg) {
  let bboxCoordinatesConverted = [];
  const bboxCoordinatesReProjection = (elem) => {
    return [...proj4(`${stacEpsg}`, "EPSG:4326", [elem[0], elem[1]]), ...proj4(`${stacEpsg}`, "EPSG:4326", [elem[2], elem[3]])];
  }
  if (typeof array[0] === 'number') {
    bboxCoordinatesConverted.push(...bboxCoordinatesReProjection(array));
  } else {
    bboxCoordinatesConverted.push(...array.map((elem) => {
      return bboxCoordinatesReProjection(elem);
    })
    )
  }
  return bboxCoordinatesConverted;
}

export const convertCoordinatesToEpsg4326 = (stacObj) => {
  if (stacObj && !!stacObj['crs']) {
    const stacEpsg = stacObj.crs.init.toUpperCase();

    if (!!stacObj['geometry'] && stacObj['type'] === 'Feature' && stacEpsg !== 'EPSG:4326') {
      const geoCoordinates = stacObj.geometry.coordinates;
      const bboxCoordinates = stacObj.bbox;
      const geoCoordinatesConverted = getGeoCoordinatesConverted(geoCoordinates, stacEpsg);
      const bboxCoordinatesConverted = getBboxCoordinatesConverted(bboxCoordinates, stacEpsg);

      stacObj.geometry.coordinates = geoCoordinatesConverted;
      stacObj.bbox = bboxCoordinatesConverted;

      delete stacObj.properties.crs;

    } else if (!!stacObj['extent'] && stacObj['type'] === 'Collection' && stacEpsg !== 'EPSG:4326') {
      const bboxCoordinates = stacObj.extent.spatial.bbox;
      const bboxCoordinatesConverted = getBboxCoordinatesConverted(bboxCoordinates, stacEpsg);
      stacObj.extent.spatial.bbox = bboxCoordinatesConverted;

    }
    delete stacObj.crs;
  }
  return stacObj;
}
