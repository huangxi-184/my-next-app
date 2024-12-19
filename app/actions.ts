"use server"

import { Parser } from "m3u8-parser"
import { z } from "zod"
import { writeFile } from "node:fs/promises"
import fs, { createReadStream, createWriteStream } from "fs"
import _ from "lodash"
import path from "path"

type Manifest = {
  segments: Segment[]
  playlists: string
}

type Segment = {
  uri: string
  index: number
}

function isValidManifest(manifest: Manifest) {
  const segmentsLength = manifest.segments?.length ?? 0
  const playlistsLength = manifest.playlists?.length ?? 0
  return segmentsLength > 0 || playlistsLength > 0
}

function parseUri(base: string, uri: string) {
  const isUrl = z.string().url().safeParse(uri).success

  if (isUrl) return uri

  const baseURL = new URL(base)
  const basePathname = baseURL.pathname.replace(/\/+$/, "").split("/").slice(0, -1).join("/")
  const pathname = `${basePathname}/${uri}`
  const parsedURL = new URL(pathname, baseURL)

  return parsedURL.toString()
}

function emptyDir(filePath: string) {
  const files = fs.readdirSync(filePath)
  files.forEach((file) => {
    const nextFilePath = `${filePath}/${file}`
    const states = fs.statSync(nextFilePath)
    if (states.isDirectory()) {
      emptyDir(nextFilePath)
    } else {
      fs.unlinkSync(nextFilePath)
    }
  })
}

export async function download(formData: FormData) {
  const url = formData.get("url") as string
  const content = await fetch(url).then((res) => res.text())
  const parser = new Parser()
  parser.push(content)
  parser.end()

  if (!isValidManifest(parser.manifest)) {
    return { success: false, message: `Unvalid Manifest` }
  }

  const segments =
    parser.manifest.segments?.map((segment: Segment, i: number) => ({
      uri: parseUri(url, segment.uri),
      index: i,
    })) ?? []

  // 开始下载m3u8文件
  const chunks = _.chunk(segments, 10)
  const downloaded: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const segmentChunk = chunks[i]
    await Promise.allSettled(
      segmentChunk.map(async (segment: unknown) => {
        const fileId = `${(segment as Segment).index}.ts`
        const res = await fetch((segment as Segment).uri)
        const file = await res.arrayBuffer()
        await writeFile(`./data/${fileId}`, Buffer.from(file))
        downloaded.push(fileId)
      })
    )
  }
  const downloadedIds = [...downloaded].sort((a, b) => parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]))

  // 合并ts文件流
  const outputFilePath = "./output_" + Date.now() + ".ts"
  const outputStream = createWriteStream(path.join("./public", outputFilePath))

  try {
    for (const id of downloadedIds) {
      const filePath = path.join("./data", id)
      const readStream = createReadStream(filePath)

      await new Promise<void>((resolve, reject) => {
        readStream.pipe(outputStream, { end: false })

        readStream.on("end", () => {
          console.log(`${filePath} has been written to output stream`)
          resolve()
        })

        readStream.on("error", (err) => {
          console.error(`Error reading ${filePath}:`, err)
          reject(err)
        })
      })
    }

    outputStream.end(() => {
      console.log("All parts have been merged into output.ts")
      emptyDir("./data")
    })
  } catch (err) {
    console.error("An error occurred during the merging process:", err)
  } finally {
    outputStream.close()
  }

  return {
    success: true,
    message: outputFilePath,
  }
}
