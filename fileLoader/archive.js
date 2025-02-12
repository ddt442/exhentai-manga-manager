const fs = require('fs')
const path = require('path')
const glob = require('glob')
const { promisify } = require('util')
const { nanoid } = require('nanoid')
const { spawn } = require('child_process')
const _ = require('lodash')
const iconv = require('iconv-lite')

const _7z = path.join(process.cwd(), 'resources/extraResources/7z.exe')

let getArchivelist = async (libraryPath)=>{
  let list = await promisify(glob)('**/*.@(rar|7z|cb7|cbr)', {
    cwd: libraryPath,
    nocase: true
  })
  list = list.map(filepath=>path.join(libraryPath, filepath))
  return list
}

let solveBookTypeArchive = async (filepath, TEMP_PATH, COVER_PATH)=>{
  let tempFolder = path.join(TEMP_PATH, nanoid())
  let output = await spawnPromise(_7z, ['l', filepath, '-slt', '-p123456'])
  let pathlist = _.filter(output.split(/\r\n/), s=>_.startsWith(s, 'Path') && !_.includes(s, '__MACOSX'))
  pathlist = pathlist.map(p=>{
    let match = /(?<== ).*$/.exec(p)
    return match ? match[0] : ''
  })
  let imageList = _.filter(pathlist, p=>['.jpg','.jpeg','.png','.webp','.avif'].includes(path.extname(p).toLowerCase()))
  imageList = imageList.sort((a,b)=>a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}))
  
  let targetFile
  let targetFilePath
  let coverFile
  let tempCoverPath
  let coverPath
  if (imageList.length > 8) {
    targetFile = imageList[7]
    coverFile = imageList[0]
    await spawnPromise(_7z, ['x', filepath, '-o'+tempFolder, targetFile, '-p123456'])
    await spawnPromise(_7z, ['x', filepath, '-o'+tempFolder, coverFile, '-p123456'])
  } else if (imageList.length > 0) {
    targetFile = imageList[0]
    coverFile = imageList[0]
    await spawnPromise(_7z, ['x', filepath, '-o'+tempFolder, targetFile, '-p123456'])
  } else {
    throw new Error('compression package isnot include image')
  }
  targetFilePath = path.join(TEMP_PATH, nanoid() + path.extname(targetFile))
  await fs.promises.copyFile(path.join(tempFolder, targetFile), targetFilePath)

  tempCoverPath = path.join(TEMP_PATH, nanoid() + path.extname(coverFile))
  await fs.promises.copyFile(path.join(tempFolder, coverFile), tempCoverPath)

  coverPath = path.join(COVER_PATH, nanoid() + path.extname(coverFile))

  let fileStat = await fs.promises.stat(filepath)
  return {targetFilePath, tempCoverPath, coverPath, pageCount: imageList.length, bundleSize: fileStat?.size}
}

let getImageListFromArchive = async (filepath, VIEWER_PATH)=>{
  await spawnPromise(_7z, ['x', filepath, '-o' + VIEWER_PATH, '-p123456'])
  let list = await promisify(glob)('**/*.@(jpg|jpeg|png|webp|avif)', {
    cwd: VIEWER_PATH,
    nocase: true
  })
  list = _.filter(list, s=>!_.includes(s, '__MACOSX'))
  list = list.sort((a,b)=>a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'})).map(f=>path.join(VIEWER_PATH, f))
  return list
}

let spawnPromise = (commmand, argument)=>{
  return new Promise((resolve, reject)=>{
    const spawned = spawn(commmand, argument)
    let output = []
    spawned.on('error', data=>{
      reject(data)
    })
    spawned.on('exit', code=>{
      if (code === 0) {
        return resolve(output.join('\r\n'))
      }
      return reject('close code is ' + code)
    })
    spawned.stdout.on('data', data=>{
      output.push(iconv.decode(data, 'gbk'))
    })
  })
}

module.exports = {
  getArchivelist,
  solveBookTypeArchive,
  getImageListFromArchive
}