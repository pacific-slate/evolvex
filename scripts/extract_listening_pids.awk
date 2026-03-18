{
  local_port = $4
  sub(/^.*:/, "", local_port)

  if (local_port != port) {
    next
  }

  line = $0
  while (match(line, /pid=[0-9]+/)) {
    print substr(line, RSTART + 4, RLENGTH - 4)
    line = substr(line, RSTART + RLENGTH)
  }
}
