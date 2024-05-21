LIGO_VERSION = 1.6.0
LIGO_COMPILER = docker run --rm -v "${PWD}":"${PWD}" -w "${PWD}" ligolang/ligo:${LIGO_VERSION}
OUTPUT_FOLDER = build

compile:
	rm -r -f ./${OUTPUT_FOLDER} 
	mkdir ./${OUTPUT_FOLDER}
	${LIGO_COMPILER} compile contract fa12.mligo -o ${OUTPUT_FOLDER}/fa12.tz
#	${LIGO_COMPILER} compile contract ctez_2.mligo -o ${OUTPUT_FOLDER}/ctez_2.tz