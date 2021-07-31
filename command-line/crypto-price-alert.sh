if [ $# -eq 1 ]; then
    node ./price_alert.js "$1"
elif [ $# -eq 2 ]; then
    node ./price_alert.js "$1" "$2"
else
    echo "Error: Wrong number of arguments."
fi
